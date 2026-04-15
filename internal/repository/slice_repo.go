package repository

import (
	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/module"
	"gorm.io/gorm"
)

// SliceRepo implements module.SliceRepository.
type SliceRepo struct {
	db *gorm.DB
}

func NewSliceRepo(db *gorm.DB) *SliceRepo {
	return &SliceRepo{db: db}
}

func (r *SliceRepo) Create(s *module.Slice) error {
	return r.db.Create(s).Error
}

func (r *SliceRepo) FindByID(id uuid.UUID) (*module.Slice, error) {
	var s module.Slice
	if err := r.db.Preload("Images").Where("id = ?", id).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SliceRepo) Update(s *module.Slice) error {
	return r.db.Save(s).Error
}

func (r *SliceRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&module.Slice{}, "id = ?", id).Error
}

func (r *SliceRepo) ListByProjectionID(projectionID int) ([]module.Slice, error) {
	var slices []module.Slice
	if err := r.db.Preload("Images").Where("projection_id = ?", projectionID).Order("slice_number ASC").Find(&slices).Error; err != nil {
		return nil, err
	}
	return slices, nil
}

func (r *SliceRepo) DeleteByProjectionID(projectionID int) error {
	return r.db.Where("projection_id = ?", projectionID).Delete(&module.Slice{}).Error
}

var _ module.SliceRepository = (*SliceRepo)(nil)

// SliceImageRepo implements module.SliceImageRepository.
type SliceImageRepo struct {
	db *gorm.DB
}

func NewSliceImageRepo(db *gorm.DB) *SliceImageRepo {
	return &SliceImageRepo{db: db}
}

func (r *SliceImageRepo) Create(si *module.SliceImage) error {
	return r.db.Create(si).Error
}

func (r *SliceImageRepo) FindBySliceAndMode(sliceID uuid.UUID, modeID int) (*module.SliceImage, error) {
	var si module.SliceImage
	if err := r.db.Where("slice_id = ? AND mode_id = ?", sliceID, modeID).First(&si).Error; err != nil {
		return nil, err
	}
	return &si, nil
}

func (r *SliceImageRepo) DeleteBySliceID(sliceID uuid.UUID) error {
	return r.db.Where("slice_id = ?", sliceID).Delete(&module.SliceImage{}).Error
}

var _ module.SliceImageRepository = (*SliceImageRepo)(nil)
