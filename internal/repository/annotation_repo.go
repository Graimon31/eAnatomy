package repository

import (
	"strings"

	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/annotation"
	"gorm.io/gorm"
)

func escapeLikeAnnotation(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

// AnnotationRepo implements annotation.AnnotationRepository.
type AnnotationRepo struct {
	db *gorm.DB
}

func NewAnnotationRepo(db *gorm.DB) *AnnotationRepo {
	return &AnnotationRepo{db: db}
}

func (r *AnnotationRepo) Create(a *annotation.Annotation) error {
	return r.db.Create(a).Error
}

func (r *AnnotationRepo) FindByID(id uuid.UUID) (*annotation.Annotation, error) {
	var a annotation.Annotation
	if err := r.db.Preload("Term").Preload("Term.Category").Where("id = ?", id).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AnnotationRepo) Update(a *annotation.Annotation) error {
	return r.db.Save(a).Error
}

func (r *AnnotationRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&annotation.Annotation{}, "id = ?", id).Error
}

func (r *AnnotationRepo) ListBySliceID(sliceID uuid.UUID) ([]annotation.Annotation, error) {
	var annotations []annotation.Annotation
	if err := r.db.
		Preload("Term").
		Preload("Term.Category").
		Where("slice_id = ?", sliceID).
		Find(&annotations).Error; err != nil {
		return nil, err
	}
	return annotations, nil
}

func (r *AnnotationRepo) CopyAnnotations(targetSliceID, sourceSliceID uuid.UUID, createdBy *uuid.UUID) error {
	sql := `INSERT INTO annotations (id, slice_id, term_id, x, y, created_by, created_at)
		SELECT gen_random_uuid(), ?, term_id, x, y, ?, now()
		FROM annotations
		WHERE slice_id = ?`
	return r.db.Exec(sql, targetSliceID, createdBy, sourceSliceID).Error
}

var _ annotation.AnnotationRepository = (*AnnotationRepo)(nil)

// AnatomicalTermRepo implements annotation.AnatomicalTermRepository.
type AnatomicalTermRepo struct {
	db *gorm.DB
}

func NewAnatomicalTermRepo(db *gorm.DB) *AnatomicalTermRepo {
	return &AnatomicalTermRepo{db: db}
}

func (r *AnatomicalTermRepo) Create(t *annotation.AnatomicalTerm) error {
	return r.db.Create(t).Error
}

func (r *AnatomicalTermRepo) FindByID(id uuid.UUID) (*annotation.AnatomicalTerm, error) {
	var t annotation.AnatomicalTerm
	if err := r.db.Preload("Category").Where("id = ?", id).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *AnatomicalTermRepo) Update(t *annotation.AnatomicalTerm) error {
	return r.db.Save(t).Error
}

func (r *AnatomicalTermRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&annotation.AnatomicalTerm{}, "id = ?", id).Error
}

func (r *AnatomicalTermRepo) List(filter annotation.TermFilter) ([]annotation.AnatomicalTerm, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	query := r.db.Model(&annotation.AnatomicalTerm{})

	if filter.CategoryID != 0 {
		query = query.Where("category_id = ?", filter.CategoryID)
	}
	if filter.Search != "" {
		search := "%" + escapeLikeAnnotation(filter.Search) + "%"
		query = query.Where("translations::text LIKE ?", search)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var terms []annotation.AnatomicalTerm
	offset := (filter.Page - 1) * filter.Limit
	if err := query.
		Preload("Category").
		Offset(offset).
		Limit(filter.Limit).
		Order("created_at DESC").
		Find(&terms).Error; err != nil {
		return nil, 0, err
	}

	return terms, total, nil
}

func (r *AnatomicalTermRepo) BulkCreate(terms []annotation.AnatomicalTerm) error {
	return r.db.Create(&terms).Error
}

var _ annotation.AnatomicalTermRepository = (*AnatomicalTermRepo)(nil)

// TermCategoryRepo implements annotation.TermCategoryRepository.
type TermCategoryRepo struct {
	db *gorm.DB
}

func NewTermCategoryRepo(db *gorm.DB) *TermCategoryRepo {
	return &TermCategoryRepo{db: db}
}

func (r *TermCategoryRepo) Create(c *annotation.TermCategory) error {
	return r.db.Create(c).Error
}

func (r *TermCategoryRepo) FindByID(id int) (*annotation.TermCategory, error) {
	var c annotation.TermCategory
	if err := r.db.Where("id = ?", id).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *TermCategoryRepo) Update(c *annotation.TermCategory) error {
	return r.db.Save(c).Error
}

func (r *TermCategoryRepo) Delete(id int) error {
	return r.db.Delete(&annotation.TermCategory{}, "id = ?", id).Error
}

func (r *TermCategoryRepo) List() ([]annotation.TermCategory, error) {
	var categories []annotation.TermCategory
	if err := r.db.Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

var _ annotation.TermCategoryRepository = (*TermCategoryRepo)(nil)
