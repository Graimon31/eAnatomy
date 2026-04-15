package editor

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"

	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/service"
	"github.com/graimon31/eanatomy/internal/task/dicom"
)

type EditorHandler struct {
	ModuleService     *service.ModuleService
	AnnotationService *service.AnnotationService
	AsynqClient       *asynq.Client
	Redis             *redis.Client
}

func NewEditorHandler(
	moduleSvc *service.ModuleService,
	annotationSvc *service.AnnotationService,
	asynqClient *asynq.Client,
	rdb *redis.Client,
) *EditorHandler {
	return &EditorHandler{
		ModuleService:     moduleSvc,
		AnnotationService: annotationSvc,
		AsynqClient:       asynqClient,
		Redis:             rdb,
	}
}

func errorResponse(c *gin.Context, status int, detail, code string) {
	c.JSON(status, gin.H{"detail": detail, "code": code})
}

func parsePagination(c *gin.Context) (page, limit int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return
}

func getUserID(c *gin.Context) (uuid.UUID, bool) {
	raw, exists := c.Get("userID")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "UNAUTHORIZED")
		return uuid.Nil, false
	}
	uid, ok := raw.(uuid.UUID)
	if !ok {
		errorResponse(c, http.StatusUnauthorized, "invalid user identity", "UNAUTHORIZED")
		return uuid.Nil, false
	}
	return uid, true
}

func getUserRole(c *gin.Context) string {
	if role, exists := c.Get("role"); exists {
		if r, ok := role.(string); ok {
			return r
		}
	}
	return "editor"
}

// --- Module CRUD ---

func (h *EditorHandler) ListModules(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	page, limit := parsePagination(c)
	filter := buildModuleFilter(c, page, limit)

	role := getUserRole(c)
	if role == "editor" {
		filter.CreatedBy = &userID
	}

	modules, total, err := h.ModuleService.ListModules(filter)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to list modules", "INTERNAL_ERROR")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": modules,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *EditorHandler) CreateModule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input service.CreateModuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	m, err := h.ModuleService.CreateModule(input, userID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "CREATE_FAILED")
		return
	}

	c.JSON(http.StatusCreated, m)
}

func (h *EditorHandler) UpdateModule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid module id", "INVALID_ID")
		return
	}

	var input service.UpdateModuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	role := getUserRole(c)
	m, err := h.ModuleService.UpdateModule(id, input, userID, role)
	if err != nil {
		switch err {
		case service.ErrModuleNotFound:
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
		case service.ErrNotModuleOwner:
			errorResponse(c, http.StatusForbidden, err.Error(), "FORBIDDEN")
		default:
			errorResponse(c, http.StatusInternalServerError, err.Error(), "UPDATE_FAILED")
		}
		return
	}

	c.JSON(http.StatusOK, m)
}

func (h *EditorHandler) DeleteModule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid module id", "INVALID_ID")
		return
	}

	role := getUserRole(c)
	if err := h.ModuleService.DeleteModule(id, userID, role); err != nil {
		switch err {
		case service.ErrModuleNotFound:
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
		case service.ErrNotModuleOwner:
			errorResponse(c, http.StatusForbidden, err.Error(), "FORBIDDEN")
		case service.ErrModuleNotDraft:
			errorResponse(c, http.StatusBadRequest, err.Error(), "NOT_DRAFT")
		default:
			errorResponse(c, http.StatusInternalServerError, err.Error(), "DELETE_FAILED")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "module deleted"})
}

func (h *EditorHandler) SubmitForReview(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid module id", "INVALID_ID")
		return
	}

	role := getUserRole(c)
	m, err := h.ModuleService.SubmitForReview(id, userID, role)
	if err != nil {
		switch err {
		case service.ErrModuleNotFound:
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
		case service.ErrNotModuleOwner:
			errorResponse(c, http.StatusForbidden, err.Error(), "FORBIDDEN")
		case service.ErrModuleNotDraft:
			errorResponse(c, http.StatusBadRequest, err.Error(), "NOT_DRAFT")
		default:
			errorResponse(c, http.StatusInternalServerError, err.Error(), "SUBMIT_FAILED")
		}
		return
	}

	c.JSON(http.StatusOK, m)
}

// --- Projections ---

func (h *EditorHandler) CreateProjection(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid module id", "INVALID_ID")
		return
	}

	var input service.CreateProjectionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	p, err := h.ModuleService.CreateProjection(moduleID, input)
	if err != nil {
		if err == service.ErrModuleNotFound {
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, err.Error(), "CREATE_FAILED")
		return
	}

	c.JSON(http.StatusCreated, p)
}

func (h *EditorHandler) DeleteProjection(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("projectionId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid projection id", "INVALID_ID")
		return
	}

	if err := h.ModuleService.DeleteProjection(id); err != nil {
		switch err {
		case service.ErrProjectionNotFound:
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
		case service.ErrProjectionHasSlices:
			errorResponse(c, http.StatusBadRequest, err.Error(), "HAS_SLICES")
		default:
			errorResponse(c, http.StatusInternalServerError, err.Error(), "DELETE_FAILED")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "projection deleted"})
}

// --- Imaging Modes ---

func (h *EditorHandler) CreateMode(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid module id", "INVALID_ID")
		return
	}

	var input service.CreateModeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	mode, err := h.ModuleService.CreateMode(moduleID, input)
	if err != nil {
		if err == service.ErrModuleNotFound {
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, err.Error(), "CREATE_FAILED")
		return
	}

	c.JSON(http.StatusCreated, mode)
}

func (h *EditorHandler) DeleteMode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("modeId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid mode id", "INVALID_ID")
		return
	}

	if err := h.ModuleService.DeleteMode(id); err != nil {
		if err == service.ErrModeNotFound {
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, err.Error(), "DELETE_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "imaging mode deleted"})
}

// --- Upload ---

func (h *EditorHandler) UploadSlices(c *gin.Context) {
	projectionID, err := strconv.Atoi(c.Param("projectionId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid projection id", "INVALID_ID")
		return
	}

	modeID, _ := strconv.Atoi(c.DefaultQuery("mode_id", "0"))

	if err := c.Request.ParseMultipartForm(500 << 20); err != nil {
		errorResponse(c, http.StatusBadRequest, "failed to parse multipart form", "PARSE_ERROR")
		return
	}

	form := c.Request.MultipartForm
	if form == nil || len(form.File["files"]) == 0 {
		errorResponse(c, http.StatusBadRequest, "no files provided", "NO_FILES")
		return
	}

	tmpDir, err := os.MkdirTemp("", fmt.Sprintf("upload-%d-*", projectionID))
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to create temp directory", "INTERNAL_ERROR")
		return
	}

	var filePaths []string
	for _, fh := range form.File["files"] {
		dst := filepath.Join(tmpDir, fh.Filename)
		if err := c.SaveUploadedFile(fh, dst); err != nil {
			os.RemoveAll(tmpDir)
			errorResponse(c, http.StatusInternalServerError, "failed to save uploaded file", "SAVE_ERROR")
			return
		}
		filePaths = append(filePaths, dst)
	}

	taskID := uuid.New().String()
	payload := dicom.ProcessUploadPayload{
		ProjectionID: projectionID,
		FilePaths:    filePaths,
		ModeID:       modeID,
		TaskID:       taskID,
	}

	task, err := dicom.NewProcessUploadTask(payload)
	if err != nil {
		os.RemoveAll(tmpDir)
		errorResponse(c, http.StatusInternalServerError, "failed to create processing task", "TASK_ERROR")
		return
	}

	if _, err := h.AsynqClient.Enqueue(task); err != nil {
		os.RemoveAll(tmpDir)
		errorResponse(c, http.StatusInternalServerError, "failed to enqueue processing task", "ENQUEUE_ERROR")
		return
	}

	ctx := context.Background()
	if err := h.Redis.HSet(ctx, "task:"+taskID, map[string]interface{}{
		"status":   "processing",
		"progress": "0",
		"done":     0,
		"total":    len(filePaths),
	}).Err(); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to initialize task", "REDIS_ERROR")
		return
	}
	h.Redis.Expire(ctx, "task:"+taskID, 24*time.Hour)

	c.JSON(http.StatusOK, gin.H{
		"task_id": taskID,
		"status":  "processing",
	})
}

func (h *EditorHandler) GetTaskProgress(c *gin.Context) {
	taskID := c.Param("taskId")
	if taskID == "" {
		errorResponse(c, http.StatusBadRequest, "task_id is required", "INVALID_ID")
		return
	}

	ctx := context.Background()
	result, err := h.Redis.HGetAll(ctx, "task:"+taskID).Result()
	if err != nil || len(result) == 0 {
		errorResponse(c, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}

	c.JSON(http.StatusOK, result)
}

// --- Slices ---

func (h *EditorHandler) ListSlices(c *gin.Context) {
	projectionID, err := strconv.Atoi(c.Param("projectionId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid projection id", "INVALID_ID")
		return
	}

	slices, err := h.ModuleService.ListSlices(projectionID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "LIST_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": slices})
}

func (h *EditorHandler) ReorderSlice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("sliceId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid slice id", "INVALID_ID")
		return
	}

	var body struct {
		SliceNumber int `json:"slice_number" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	if err := h.ModuleService.ReorderSlice(id, body.SliceNumber); err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "REORDER_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "slice reordered"})
}

func (h *EditorHandler) DeleteSlice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("sliceId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid slice id", "INVALID_ID")
		return
	}

	if err := h.ModuleService.DeleteSlice(id); err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "DELETE_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "slice deleted"})
}

// --- Annotations ---

func (h *EditorHandler) ListAnnotations(c *gin.Context) {
	sliceID, err := uuid.Parse(c.Param("sliceId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid slice id", "INVALID_ID")
		return
	}

	annotations, err := h.AnnotationService.ListBySlice(sliceID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "LIST_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": annotations})
}

func (h *EditorHandler) CreateAnnotation(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input service.CreateAnnotationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	a, err := h.AnnotationService.CreateAnnotation(input, userID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "CREATE_FAILED")
		return
	}

	c.JSON(http.StatusCreated, a)
}

func (h *EditorHandler) UpdateAnnotation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("annotationId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid annotation id", "INVALID_ID")
		return
	}

	var input service.UpdateAnnotationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errorResponse(c, http.StatusBadRequest, err.Error(), "VALIDATION_ERROR")
		return
	}

	a, err := h.AnnotationService.UpdateAnnotation(id, input)
	if err != nil {
		if err == service.ErrAnnotationNotFound {
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, err.Error(), "UPDATE_FAILED")
		return
	}

	c.JSON(http.StatusOK, a)
}

func (h *EditorHandler) DeleteAnnotation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("annotationId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid annotation id", "INVALID_ID")
		return
	}

	if err := h.AnnotationService.DeleteAnnotation(id); err != nil {
		if err == service.ErrAnnotationNotFound {
			errorResponse(c, http.StatusNotFound, err.Error(), "NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, err.Error(), "DELETE_FAILED")
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "annotation deleted"})
}

func (h *EditorHandler) CopyAnnotations(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	targetSliceID, err := uuid.Parse(c.Param("sliceId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid target slice id", "INVALID_ID")
		return
	}

	sourceSliceID, err := uuid.Parse(c.Param("sourceId"))
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid source slice id", "INVALID_ID")
		return
	}

	if err := h.AnnotationService.CopyAnnotations(targetSliceID, sourceSliceID, userID); err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "COPY_FAILED")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"detail": "annotations copied"})
}

func buildModuleFilter(c *gin.Context, page, limit int) module.ModuleFilter {
	filter := module.ModuleFilter{
		Page:  page,
		Limit: limit,
	}

	if status := c.Query("status"); status != "" {
		filter.Status = status
	}
	if regionID, err := strconv.Atoi(c.Query("region_id")); err == nil {
		filter.RegionID = regionID
	}
	if modalityID, err := strconv.Atoi(c.Query("modality_id")); err == nil {
		filter.ModalityID = modalityID
	}
	if accessLevel := c.Query("access_level"); accessLevel != "" {
		filter.AccessLevel = accessLevel
	}

	return filter
}
