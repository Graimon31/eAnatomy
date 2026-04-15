package repository

import (
	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/module"
	"gorm.io/gorm"
)

// ModuleRepo implements module.ModuleRepository.
type ModuleRepo struct {
	db *gorm.DB
}

func NewModuleRepo(db *gorm.DB) *ModuleRepo {
	return &ModuleRepo{db: db}
}

func (r *ModuleRepo) Create(m *module.Module) error {
	return r.db.Create(m).Error
}

func (r *ModuleRepo) FindByID(id uuid.UUID) (*module.Module, error) {
	var m module.Module
	if err := r.db.Preload("Region").Preload("Modality").Where("id = ?", id).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ModuleRepo) FindBySlug(slug string) (*module.Module, error) {
	var m module.Module
	if err := r.db.
		Preload("Region").
		Preload("Modality").
		Preload("Projections").
		Preload("Modes").
		Where("slug = ?", slug).
		First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ModuleRepo) Update(m *module.Module) error {
	return r.db.Save(m).Error
}

func (r *ModuleRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&module.Module{}, "id = ?", id).Error
}

func (r *ModuleRepo) List(filter module.ModuleFilter) ([]module.Module, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	query := r.db.Model(&module.Module{})

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.RegionID != 0 {
		query = query.Where("region_id = ?", filter.RegionID)
	}
	if filter.ModalityID != 0 {
		query = query.Where("modality_id = ?", filter.ModalityID)
	}
	if filter.AccessLevel != "" {
		query = query.Where("access_level = ?", filter.AccessLevel)
	}
	if filter.CreatedBy != nil {
		query = query.Where("created_by = ?", *filter.CreatedBy)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var modules []module.Module
	offset := (filter.Page - 1) * filter.Limit
	if err := query.
		Preload("Region").
		Preload("Modality").
		Offset(offset).
		Limit(filter.Limit).
		Order("created_at DESC").
		Find(&modules).Error; err != nil {
		return nil, 0, err
	}

	return modules, total, nil
}

var _ module.ModuleRepository = (*ModuleRepo)(nil)

// RegionRepo implements module.RegionRepository.
type RegionRepo struct {
	db *gorm.DB
}

func NewRegionRepo(db *gorm.DB) *RegionRepo {
	return &RegionRepo{db: db}
}

func (r *RegionRepo) List() ([]module.Region, error) {
	var regions []module.Region
	if err := r.db.Order("sort_order ASC").Find(&regions).Error; err != nil {
		return nil, err
	}
	return regions, nil
}

func (r *RegionRepo) FindByID(id int) (*module.Region, error) {
	var region module.Region
	if err := r.db.Where("id = ?", id).First(&region).Error; err != nil {
		return nil, err
	}
	return &region, nil
}

var _ module.RegionRepository = (*RegionRepo)(nil)

// ModalityRepo implements module.ModalityRepository.
type ModalityRepo struct {
	db *gorm.DB
}

func NewModalityRepo(db *gorm.DB) *ModalityRepo {
	return &ModalityRepo{db: db}
}

func (r *ModalityRepo) List() ([]module.Modality, error) {
	var modalities []module.Modality
	if err := r.db.Find(&modalities).Error; err != nil {
		return nil, err
	}
	return modalities, nil
}

func (r *ModalityRepo) FindByID(id int) (*module.Modality, error) {
	var modality module.Modality
	if err := r.db.Where("id = ?", id).First(&modality).Error; err != nil {
		return nil, err
	}
	return &modality, nil
}

var _ module.ModalityRepository = (*ModalityRepo)(nil)
