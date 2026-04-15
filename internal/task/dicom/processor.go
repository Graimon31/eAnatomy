package dicom

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
	dicomlib "github.com/suyashkumar/dicom"
	"github.com/suyashkumar/dicom/pkg/tag"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"

	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/storage"
)

const TypeProcessUpload = "dicom:process_upload"

type ProcessUploadPayload struct {
	ProjectionID int      `json:"projection_id"`
	FilePaths    []string `json:"file_paths"`
	ModeID       int      `json:"mode_id"`
	TaskID       string   `json:"task_id"`
}

func NewProcessUploadTask(payload ProcessUploadPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal process upload payload: %w", err)
	}
	return asynq.NewTask(TypeProcessUpload, data), nil
}

type ProcessUploadHandler struct {
	DB      *gorm.DB
	Storage *storage.MinIOStorage
	Redis   *redis.Client
}

func HandleProcessUpload(db *gorm.DB, store *storage.MinIOStorage, rdb *redis.Client) *ProcessUploadHandler {
	return &ProcessUploadHandler{
		DB:      db,
		Storage: store,
		Redis:   rdb,
	}
}

func (h *ProcessUploadHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload ProcessUploadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	totalFiles := len(payload.FilePaths)
	if totalFiles == 0 {
		return nil
	}

	var processed int64

	g, gCtx := errgroup.WithContext(ctx)
	g.SetLimit(5)

	for i, fp := range payload.FilePaths {
		sliceNumber := i + 1
		filePath := fp

		g.Go(func() error {
			imgData, width, height, err := loadImage(filePath)
			if err != nil {
				return fmt.Errorf("process file %s: %w", filePath, err)
			}

			thumbData, err := generateThumbnail(imgData, 200, 200)
			if err != nil {
				return fmt.Errorf("thumbnail for %s: %w", filePath, err)
			}

			folder := fmt.Sprintf("projections/%d", payload.ProjectionID)
			originalName := fmt.Sprintf("%04d.jpg", sliceNumber)
			thumbName := fmt.Sprintf("%04d_thumb.jpg", sliceNumber)

			originalPath, err := h.Storage.Upload(gCtx, folder, originalName, imgData, "image/jpeg")
			if err != nil {
				return fmt.Errorf("upload original %s: %w", filePath, err)
			}

			thumbPath, err := h.Storage.Upload(gCtx, folder, thumbName, thumbData, "image/jpeg")
			if err != nil {
				return fmt.Errorf("upload thumbnail %s: %w", filePath, err)
			}

			imageURL := h.Storage.GetPublicURL(originalPath)
			thumbnailURL := h.Storage.GetPublicURL(thumbPath)

			if err := h.DB.WithContext(gCtx).Transaction(func(tx *gorm.DB) error {
				slice := module.Slice{
					ID:           uuid.New(),
					ProjectionID: payload.ProjectionID,
					SliceNumber:  sliceNumber,
					WidthPx:      width,
					HeightPx:     height,
				}
				if err := tx.Create(&slice).Error; err != nil {
					return fmt.Errorf("create slice: %w", err)
				}

				sliceImage := module.SliceImage{
					SliceID:      slice.ID,
					ModeID:       payload.ModeID,
					ImageURL:     imageURL,
					ThumbnailURL: thumbnailURL,
				}
				if err := tx.Create(&sliceImage).Error; err != nil {
					return fmt.Errorf("create slice_image: %w", err)
				}

				return nil
			}); err != nil {
				return err
			}

			done := atomic.AddInt64(&processed, 1)
			progress := float64(done) / float64(totalFiles) * 100
			h.Redis.HSet(gCtx, "task:"+payload.TaskID, map[string]interface{}{
				"progress": fmt.Sprintf("%.0f", progress),
				"done":     done,
				"total":    totalFiles,
			})

			_ = os.Remove(filePath)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		h.Redis.HSet(ctx, "task:"+payload.TaskID, "status", "failed", "error", err.Error())
		return err
	}

	h.Redis.HSet(ctx, "task:"+payload.TaskID, "status", "completed", "progress", "100")
	return nil
}

func loadImage(filePath string) (imgData []byte, width, height int, err error) {
	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".dcm":
		return loadDICOM(filePath)
	case ".jpg", ".jpeg":
		return loadStandardImage(filePath, "jpeg")
	case ".png":
		return loadStandardImage(filePath, "png")
	default:
		return nil, 0, 0, fmt.Errorf("unsupported file extension: %s", ext)
	}
}

func loadDICOM(filePath string) ([]byte, int, int, error) {
	dataset, err := dicomlib.ParseFile(filePath, nil)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("parse dicom: %w", err)
	}

	// Extract pixel data
	pixelDataElem, err := dataset.FindElementByTag(tag.PixelData)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("dicom missing PixelData: %w", err)
	}

	pixelDataInfo, ok := pixelDataElem.Value.GetValue().(dicomlib.PixelDataInfo)
	if !ok {
		return nil, 0, 0, fmt.Errorf("unexpected pixel data type")
	}

	if len(pixelDataInfo.Frames) == 0 {
		return nil, 0, 0, fmt.Errorf("dicom has no frames")
	}

	// Use the built-in GetImage() which handles windowing internally
	frame := pixelDataInfo.Frames[0]
	img, err := frame.GetImage()
	if err != nil {
		return nil, 0, 0, fmt.Errorf("get image from frame: %w", err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Encode to JPEG
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return nil, 0, 0, fmt.Errorf("encode dicom jpeg: %w", err)
	}

	return buf.Bytes(), width, height, nil
}

func loadStandardImage(filePath, format string) ([]byte, int, int, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("open image: %w", err)
	}
	defer f.Close()

	var img image.Image
	switch format {
	case "jpeg":
		img, err = jpeg.Decode(f)
	case "png":
		img, err = png.Decode(f)
	default:
		return nil, 0, 0, fmt.Errorf("unsupported format: %s", format)
	}
	if err != nil {
		return nil, 0, 0, fmt.Errorf("decode %s: %w", format, err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("read file bytes: %w", err)
	}

	return data, width, height, nil
}

func generateThumbnail(imgData []byte, thumbWidth, thumbHeight int) ([]byte, error) {
	img, err := imaging.Decode(bytes.NewReader(imgData))
	if err != nil {
		return nil, fmt.Errorf("decode for thumbnail: %w", err)
	}

	thumb := imaging.Fit(img, thumbWidth, thumbHeight, imaging.Lanczos)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 75}); err != nil {
		return nil, fmt.Errorf("encode thumbnail: %w", err)
	}

	return buf.Bytes(), nil
}
