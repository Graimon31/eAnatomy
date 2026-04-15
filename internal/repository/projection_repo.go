package repository

import (
	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/module"
	"gorm.io/gorm"
)

// ProjectionRepo implements module.ProjectionRepository.
type ProjectionRepo struct {
	db *gorm.DB
}

func NewProjectionRepo(db *gorm.DB) *ProjectionRepo {
	return &ProjectionRepo{db: db}
}

func (r *ProjectionRepo) Create(p *module.Projection) error {
	return r.db.Create(p).Error
}

func (r *ProjectionRepo) FindByID(id int) (*module.Projection, error) {
	var p module.Projection
	if err := r.db.Preload("Slices").Where("id = ?", id).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProjectionRepo) Delete(id int) error {
	return r.db.Delete(&module.Projection{}, "id = ?", id).Error
}

func (r *ProjectionRepo) ListByModuleID(moduleID uuid.UUID) ([]module.Projection, error) {
	var projections []module.Projection
	if err := r.db.Where("module_id = ?", moduleID).Order("sort_order ASC").Find(&projections).Error; err != nil {
		return nil, err
	}
	return projections, nil
}

func (r *ProjectionRepo) HasSlices(id int) (bool, error) {
	var count int64
	if err := r.db.Model(&module.Slice{}).Where("projection_id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

var _ module.ProjectionRepository = (*ProjectionRepo)(nil)

// ImagingModeRepo implements module.ImagingModeRepository.
type ImagingModeRepo struct {
	db *gorm.DB
}

func NewImagingModeRepo(db *gorm.DB) *ImagingModeRepo {
	return &ImagingModeRepo{db: db}
}

func (r *ImagingModeRepo) Create(m *module.ImagingMode) error {
	return r.db.Create(m).Error
}

func (r *ImagingModeRepo) Delete(id int) error {
	return r.db.Delete(&module.ImagingMode{}, "id = ?", id).Error
}

func (r *ImagingModeRepo) ListByModuleID(moduleID uuid.UUID) ([]module.ImagingMode, error) {
	var modes []module.ImagingMode
	if err := r.db.Where("module_id = ?", moduleID).Find(&modes).Error; err != nil {
		return nil, err
	}
	return modes, nil
}

var _ module.ImagingModeRepository = (*ImagingModeRepo)(nil)
