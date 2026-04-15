package annotation

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type TermCategory struct {
	ID               int            `gorm:"primaryKey;autoIncrement" json:"id"`
	NameTranslations datatypes.JSON `gorm:"type:jsonb" json:"name_translations"`
	ColorHex         string         `gorm:"type:varchar(7)" json:"color_hex"`
	IconURL          string         `gorm:"type:varchar(500)" json:"icon_url"`
}

func (TermCategory) TableName() string {
	return "term_categories"
}

type AnatomicalTerm struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FmaID        string         `gorm:"type:varchar(50)" json:"fma_id"`
	Translations datatypes.JSON `gorm:"type:jsonb;not null" json:"translations"`
	CategoryID   *int           `gorm:"type:int" json:"category_id"`
	CreatedBy    *uuid.UUID     `gorm:"type:uuid" json:"created_by"`
	CreatedAt    time.Time      `gorm:"default:now()" json:"created_at"`

	Category *TermCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
}

func (AnatomicalTerm) TableName() string {
	return "anatomical_terms"
}

type Annotation struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SliceID   uuid.UUID  `gorm:"type:uuid;not null" json:"slice_id"`
	TermID    uuid.UUID  `gorm:"type:uuid" json:"term_id"`
	X         float64    `gorm:"not null" json:"x"`
	Y         float64    `gorm:"not null" json:"y"`
	CreatedBy *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt time.Time  `gorm:"default:now()" json:"created_at"`

	Term *AnatomicalTerm `gorm:"foreignKey:TermID" json:"term,omitempty"`
}

func (Annotation) TableName() string {
	return "annotations"
}

type TermCategoryRepository interface {
	Create(c *TermCategory) error
	FindByID(id int) (*TermCategory, error)
	Update(c *TermCategory) error
	Delete(id int) error
	List() ([]TermCategory, error)
}

type AnatomicalTermRepository interface {
	Create(t *AnatomicalTerm) error
	FindByID(id uuid.UUID) (*AnatomicalTerm, error)
	Update(t *AnatomicalTerm) error
	Delete(id uuid.UUID) error
	List(filter TermFilter) ([]AnatomicalTerm, int64, error)
	BulkCreate(terms []AnatomicalTerm) error
}

type AnnotationRepository interface {
	Create(a *Annotation) error
	FindByID(id uuid.UUID) (*Annotation, error)
	Update(a *Annotation) error
	Delete(id uuid.UUID) error
	ListBySliceID(sliceID uuid.UUID) ([]Annotation, error)
	CopyAnnotations(targetSliceID, sourceSliceID uuid.UUID, createdBy *uuid.UUID) error
}

type TermFilter struct {
	CategoryID int
	Search     string
	Page       int
	Limit      int
}
