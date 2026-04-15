package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gosimple/slug"

	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/storage"
)

var (
	ErrModuleNotFound     = errors.New("module not found")
	ErrModuleNotDraft     = errors.New("module must be in draft status")
	ErrModuleNotReview    = errors.New("module must be in review status")
	ErrNotModuleOwner     = errors.New("you don't own this module")
	ErrProjectionNotFound = errors.New("projection not found")
	ErrProjectionHasSlices = errors.New("cannot delete projection with existing slices")
	ErrModeNotFound       = errors.New("imaging mode not found")
)

type ModuleService struct {
	moduleRepo     module.ModuleRepository
	projectionRepo module.ProjectionRepository
	modeRepo       module.ImagingModeRepository
	sliceRepo      module.SliceRepository
	sliceImageRepo module.SliceImageRepository
	storage        *storage.MinIOStorage
}

func NewModuleService(
	moduleRepo module.ModuleRepository,
	projectionRepo module.ProjectionRepository,
	modeRepo module.ImagingModeRepository,
	sliceRepo module.SliceRepository,
	sliceImageRepo module.SliceImageRepository,
	storage *storage.MinIOStorage,
) *ModuleService {
	return &ModuleService{
		moduleRepo:     moduleRepo,
		projectionRepo: projectionRepo,
		modeRepo:       modeRepo,
		sliceRepo:      sliceRepo,
		sliceImageRepo: sliceImageRepo,
		storage:        storage,
	}
}

type CreateModuleInput struct {
	RegionID              *int                   `json:"region_id"`
	ModalityID            *int                   `json:"modality_id"`
	AccessLevel           string                 `json:"access_level" binding:"required,oneof=free premium"`
	MetaTitleTranslations map[string]string       `json:"meta_title_translations" binding:"required"`
	MetaDescTranslations  map[string]string       `json:"meta_desc_translations"`
}

type UpdateModuleInput struct {
	RegionID              *int                   `json:"region_id"`
	ModalityID            *int                   `json:"modality_id"`
	AccessLevel           string                 `json:"access_level"`
	MetaTitleTranslations map[string]string       `json:"meta_title_translations"`
	MetaDescTranslations  map[string]string       `json:"meta_desc_translations"`
}

func (s *ModuleService) CreateModule(input CreateModuleInput, createdBy uuid.UUID) (*module.Module, error) {
	title := ""
	if en, ok := input.MetaTitleTranslations["en"]; ok {
		title = en
	} else if ru, ok := input.MetaTitleTranslations["ru"]; ok {
		title = ru
	} else {
		for _, v := range input.MetaTitleTranslations {
			title = v
			break
		}
	}

	moduleSlug := slug.Make(title)
	if moduleSlug == "" {
		moduleSlug = fmt.Sprintf("module-%s", uuid.New().String()[:8])
	}

	titleJSON, _ := marshalJSON(input.MetaTitleTranslations)
	descJSON, _ := marshalJSON(input.MetaDescTranslations)

	m := &module.Module{
		Slug:                  moduleSlug,
		RegionID:              input.RegionID,
		ModalityID:            input.ModalityID,
		AccessLevel:           module.AccessLevel(input.AccessLevel),
		Status:                module.StatusDraft,
		CreatedBy:             &createdBy,
		MetaTitleTranslations: titleJSON,
		MetaDescTranslations:  descJSON,
	}

	if err := s.moduleRepo.Create(m); err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			m.Slug = fmt.Sprintf("%s-%s", moduleSlug, uuid.New().String()[:8])
			if err := s.moduleRepo.Create(m); err != nil {
				return nil, fmt.Errorf("failed to create module: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to create module: %w", err)
		}
	}

	return m, nil
}

func (s *ModuleService) UpdateModule(id uuid.UUID, input UpdateModuleInput, userID uuid.UUID, userRole string) (*module.Module, error) {
	m, err := s.moduleRepo.FindByID(id)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	if userRole == "editor" && (m.CreatedBy == nil || *m.CreatedBy != userID) {
		return nil, ErrNotModuleOwner
	}

	if input.RegionID != nil {
		m.RegionID = input.RegionID
	}
	if input.ModalityID != nil {
		m.ModalityID = input.ModalityID
	}
	if input.AccessLevel != "" {
		m.AccessLevel = module.AccessLevel(input.AccessLevel)
	}
	if input.MetaTitleTranslations != nil {
		titleJSON, _ := marshalJSON(input.MetaTitleTranslations)
		m.MetaTitleTranslations = titleJSON
	}
	if input.MetaDescTranslations != nil {
		descJSON, _ := marshalJSON(input.MetaDescTranslations)
		m.MetaDescTranslations = descJSON
	}

	if err := s.moduleRepo.Update(m); err != nil {
		return nil, fmt.Errorf("failed to update module: %w", err)
	}

	return m, nil
}

func (s *ModuleService) DeleteModule(id uuid.UUID, userID uuid.UUID, userRole string) error {
	m, err := s.moduleRepo.FindByID(id)
	if err != nil {
		return ErrModuleNotFound
	}

	if userRole == "editor" {
		if m.CreatedBy == nil || *m.CreatedBy != userID {
			return ErrNotModuleOwner
		}
		if m.Status != module.StatusDraft {
			return ErrModuleNotDraft
		}
	}

	// Delete all files from MinIO for this module's projections
	if s.storage != nil {
		projections, _ := s.projectionRepo.ListByModuleID(id)
		for _, p := range projections {
			prefix := fmt.Sprintf("%d/", p.ID)
			_ = s.storage.DeleteFolder(context.Background(), prefix)
		}
	}

	return s.moduleRepo.Delete(id)
}

func (s *ModuleService) SubmitForReview(id uuid.UUID, userID uuid.UUID, userRole string) (*module.Module, error) {
	m, err := s.moduleRepo.FindByID(id)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	if userRole == "editor" && (m.CreatedBy == nil || *m.CreatedBy != userID) {
		return nil, ErrNotModuleOwner
	}

	if m.Status != module.StatusDraft {
		return nil, ErrModuleNotDraft
	}

	m.Status = module.StatusReview
	if err := s.moduleRepo.Update(m); err != nil {
		return nil, fmt.Errorf("failed to submit for review: %w", err)
	}

	return m, nil
}

func (s *ModuleService) PublishModule(id uuid.UUID) (*module.Module, error) {
	m, err := s.moduleRepo.FindByID(id)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	if m.Status != module.StatusReview {
		return nil, ErrModuleNotReview
	}

	now := time.Now()
	m.Status = module.StatusPublished
	m.PublishedAt = &now
	if err := s.moduleRepo.Update(m); err != nil {
		return nil, fmt.Errorf("failed to publish module: %w", err)
	}

	return m, nil
}

type RejectModuleInput struct {
	Reason string `json:"reason" binding:"required"`
}

func (s *ModuleService) RejectModule(id uuid.UUID, reason string) (*module.Module, error) {
	m, err := s.moduleRepo.FindByID(id)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	if m.Status != module.StatusReview {
		return nil, ErrModuleNotReview
	}

	m.Status = module.StatusDraft
	if err := s.moduleRepo.Update(m); err != nil {
		return nil, fmt.Errorf("failed to reject module: %w", err)
	}

	return m, nil
}

type ModuleFilter = module.ModuleFilter

func (s *ModuleService) ListModules(filter module.ModuleFilter) ([]module.Module, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.moduleRepo.List(filter)
}

func (s *ModuleService) GetModuleByID(id uuid.UUID) (*module.Module, error) {
	return s.moduleRepo.FindByID(id)
}

func (s *ModuleService) GetModuleBySlug(slug string) (*module.Module, error) {
	return s.moduleRepo.FindBySlug(slug)
}

// Projections

type CreateProjectionInput struct {
	Type      string `json:"type" binding:"required,oneof=axial sagittal frontal 3d"`
	SortOrder int    `json:"sort_order"`
}

func (s *ModuleService) CreateProjection(moduleID uuid.UUID, input CreateProjectionInput) (*module.Projection, error) {
	_, err := s.moduleRepo.FindByID(moduleID)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	p := &module.Projection{
		ModuleID:  moduleID,
		Type:      module.ProjectionType(input.Type),
		SortOrder: input.SortOrder,
	}

	if err := s.projectionRepo.Create(p); err != nil {
		return nil, fmt.Errorf("failed to create projection: %w", err)
	}

	return p, nil
}

func (s *ModuleService) DeleteProjection(id int) error {
	hasSlices, err := s.projectionRepo.HasSlices(id)
	if err != nil {
		return ErrProjectionNotFound
	}
	if hasSlices {
		return ErrProjectionHasSlices
	}
	return s.projectionRepo.Delete(id)
}

// Imaging Modes

type CreateModeInput struct {
	Name string `json:"name" binding:"required"`
}

func (s *ModuleService) CreateMode(moduleID uuid.UUID, input CreateModeInput) (*module.ImagingMode, error) {
	_, err := s.moduleRepo.FindByID(moduleID)
	if err != nil {
		return nil, ErrModuleNotFound
	}

	m := &module.ImagingMode{
		ModuleID: moduleID,
		Name:     input.Name,
	}

	if err := s.modeRepo.Create(m); err != nil {
		return nil, fmt.Errorf("failed to create imaging mode: %w", err)
	}

	return m, nil
}

func (s *ModuleService) DeleteMode(id int) error {
	return s.modeRepo.Delete(id)
}

// Slices

func (s *ModuleService) ListSlices(projectionID int) ([]module.Slice, error) {
	return s.sliceRepo.ListByProjectionID(projectionID)
}

func (s *ModuleService) ReorderSlice(id uuid.UUID, newNumber int) error {
	sl, err := s.sliceRepo.FindByID(id)
	if err != nil {
		return errors.New("slice not found")
	}

	sl.SliceNumber = newNumber
	return s.sliceRepo.Update(sl)
}

func (s *ModuleService) DeleteSlice(id uuid.UUID) error {
	sl, err := s.sliceRepo.FindByID(id)
	if err != nil {
		return errors.New("slice not found")
	}

	// Delete files from MinIO
	if s.storage != nil {
		prefix := fmt.Sprintf("%d/%04d", sl.ProjectionID, sl.SliceNumber)
		_ = s.storage.DeleteFolder(context.Background(), prefix)
	}

	return s.sliceRepo.Delete(id)
}

// Regions & Modalities

type RegionService struct {
	regionRepo   module.RegionRepository
	modalityRepo module.ModalityRepository
}

func NewRegionService(regionRepo module.RegionRepository, modalityRepo module.ModalityRepository) *RegionService {
	return &RegionService{regionRepo: regionRepo, modalityRepo: modalityRepo}
}

func (s *RegionService) ListRegions() ([]module.Region, error) {
	return s.regionRepo.List()
}

func (s *RegionService) ListModalities() ([]module.Modality, error) {
	return s.modalityRepo.List()
}
