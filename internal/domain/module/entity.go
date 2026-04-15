package module

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type AccessLevel string

const (
	AccessFree    AccessLevel = "free"
	AccessPremium AccessLevel = "premium"
)

type ModuleStatus string

const (
	StatusDraft     ModuleStatus = "draft"
	StatusReview    ModuleStatus = "review"
	StatusPublished ModuleStatus = "published"
	StatusArchived  ModuleStatus = "archived"
)

type Region struct {
	ID               int            `gorm:"primaryKey;autoIncrement" json:"id"`
	Slug             string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"slug"`
	NameTranslations datatypes.JSON `gorm:"type:jsonb" json:"name_translations"`
	SortOrder        int            `gorm:"default:0" json:"sort_order"`
}

func (Region) TableName() string {
	return "regions"
}

type Modality struct {
	ID               int            `gorm:"primaryKey;autoIncrement" json:"id"`
	Code             string         `gorm:"type:varchar(50);uniqueIndex" json:"code"`
	NameTranslations datatypes.JSON `gorm:"type:jsonb" json:"name_translations"`
}

func (Modality) TableName() string {
	return "modalities"
}

type Module struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Slug                  string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	RegionID              *int           `gorm:"type:int" json:"region_id"`
	ModalityID            *int           `gorm:"type:int" json:"modality_id"`
	AccessLevel           AccessLevel    `gorm:"type:varchar(10);default:'premium'" json:"access_level"`
	Status                ModuleStatus   `gorm:"type:varchar(20);default:'draft'" json:"status"`
	CreatedBy             *uuid.UUID     `gorm:"type:uuid" json:"created_by"`
	PublishedAt           *time.Time     `json:"published_at"`
	MetaTitleTranslations datatypes.JSON `gorm:"type:jsonb" json:"meta_title_translations"`
	MetaDescTranslations  datatypes.JSON `gorm:"type:jsonb" json:"meta_desc_translations"`
	CreatedAt             time.Time      `gorm:"default:now()" json:"created_at"`
	UpdatedAt             time.Time      `gorm:"default:now()" json:"updated_at"`

	Region      *Region      `gorm:"foreignKey:RegionID" json:"region,omitempty"`
	Modality    *Modality    `gorm:"foreignKey:ModalityID" json:"modality,omitempty"`
	Projections []Projection `gorm:"foreignKey:ModuleID" json:"projections,omitempty"`
	Modes       []ImagingMode `gorm:"foreignKey:ModuleID" json:"modes,omitempty"`
}

func (Module) TableName() string {
	return "modules"
}

type ProjectionType string

const (
	ProjectionAxial    ProjectionType = "axial"
	ProjectionSagittal ProjectionType = "sagittal"
	ProjectionCoronal  ProjectionType = "coronal"
	ProjectionFrontal  ProjectionType = "frontal"
	Projection3D       ProjectionType = "3d"
)

type Projection struct {
	ID        int            `gorm:"primaryKey;autoIncrement" json:"id"`
	ModuleID  uuid.UUID      `gorm:"type:uuid;not null" json:"module_id"`
	Type      ProjectionType `gorm:"type:varchar(20)" json:"type"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`

	Slices []Slice `gorm:"foreignKey:ProjectionID" json:"slices,omitempty"`
}

func (Projection) TableName() string {
	return "projections"
}

type ImagingMode struct {
	ID       int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ModuleID uuid.UUID `gorm:"type:uuid;not null" json:"module_id"`
	Name     string    `gorm:"type:varchar(50)" json:"name"`
}

func (ImagingMode) TableName() string {
	return "imaging_modes"
}

type Slice struct {
	ID           uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectionID int          `gorm:"not null" json:"projection_id"`
	SliceNumber  int          `gorm:"not null" json:"slice_number"`
	WidthPx      int          `json:"width_px"`
	HeightPx     int          `json:"height_px"`

	Images []SliceImage `gorm:"foreignKey:SliceID" json:"images,omitempty"`
}

func (Slice) TableName() string {
	return "slices"
}

type SliceImage struct {
	ID           int       `gorm:"primaryKey;autoIncrement" json:"id"`
	SliceID      uuid.UUID `gorm:"type:uuid;not null" json:"slice_id"`
	ModeID       int       `gorm:"type:int" json:"mode_id"`
	ImageURL     string    `gorm:"type:varchar(500);not null" json:"image_url"`
	ThumbnailURL string    `gorm:"type:varchar(500)" json:"thumbnail_url"`
}

func (SliceImage) TableName() string {
	return "slice_images"
}

type ModuleRepository interface {
	Create(m *Module) error
	FindByID(id uuid.UUID) (*Module, error)
	FindBySlug(slug string) (*Module, error)
	Update(m *Module) error
	Delete(id uuid.UUID) error
	List(filter ModuleFilter) ([]Module, int64, error)
}

type ProjectionRepository interface {
	Create(p *Projection) error
	FindByID(id int) (*Projection, error)
	Delete(id int) error
	ListByModuleID(moduleID uuid.UUID) ([]Projection, error)
	HasSlices(id int) (bool, error)
}

type ImagingModeRepository interface {
	Create(m *ImagingMode) error
	Delete(id int) error
	ListByModuleID(moduleID uuid.UUID) ([]ImagingMode, error)
}

type SliceRepository interface {
	Create(s *Slice) error
	FindByID(id uuid.UUID) (*Slice, error)
	Update(s *Slice) error
	Delete(id uuid.UUID) error
	ListByProjectionID(projectionID int) ([]Slice, error)
	DeleteByProjectionID(projectionID int) error
}

type SliceImageRepository interface {
	Create(si *SliceImage) error
	FindBySliceAndMode(sliceID uuid.UUID, modeID int) (*SliceImage, error)
	DeleteBySliceID(sliceID uuid.UUID) error
}

type RegionRepository interface {
	List() ([]Region, error)
	FindByID(id int) (*Region, error)
}

type ModalityRepository interface {
	List() ([]Modality, error)
	FindByID(id int) (*Modality, error)
}

type ModuleFilter struct {
	Status     string
	RegionID   int
	ModalityID int
	AccessLevel string
	CreatedBy  *uuid.UUID
	Lang       string
	Page       int
	Limit      int
}
