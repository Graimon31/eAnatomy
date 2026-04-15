package subscription

import (
	"time"

	"github.com/google/uuid"
)

type Plan string

const (
	PlanMonthly       Plan = "monthly"
	PlanYearly        Plan = "yearly"
	PlanInstitutional Plan = "institutional"
)

type Status string

const (
	StatusActive    Status = "active"
	StatusCancelled Status = "cancelled"
	StatusExpired   Status = "expired"
)

type PaymentProvider string

const (
	ProviderStripe   PaymentProvider = "stripe"
	ProviderYooKassa PaymentProvider = "yookassa"
	ProviderPayPal   PaymentProvider = "paypal"
)

type Subscription struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID       `gorm:"type:uuid;not null" json:"user_id"`
	Plan            Plan            `gorm:"type:varchar(20)" json:"plan"`
	Status          Status          `gorm:"type:varchar(20)" json:"status"`
	StartedAt       *time.Time      `json:"started_at"`
	ExpiresAt       *time.Time      `json:"expires_at"`
	PaymentProvider PaymentProvider `gorm:"type:varchar(20)" json:"payment_provider"`
	ExternalID      string          `gorm:"type:varchar(255)" json:"external_id"`
}

func (Subscription) TableName() string {
	return "subscriptions"
}

type IPAccessRange struct {
	ID              int        `gorm:"primaryKey;autoIncrement" json:"id"`
	CIDR            string     `gorm:"type:cidr;not null" json:"cidr"`
	InstitutionName string     `gorm:"type:varchar(255)" json:"institution_name"`
	ExpiresAt       *time.Time `json:"expires_at"`
}

func (IPAccessRange) TableName() string {
	return "ip_access_ranges"
}

type SubscriptionRepository interface {
	Create(sub *Subscription) error
	FindByID(id uuid.UUID) (*Subscription, error)
	FindActiveByUserID(userID uuid.UUID) (*Subscription, error)
	Update(sub *Subscription) error
	List(filter SubscriptionFilter) ([]Subscription, int64, error)
	FindExpiringSoon(days int) ([]Subscription, error)
}

type IPAccessRangeRepository interface {
	Create(r *IPAccessRange) error
	Delete(id int) error
	List() ([]IPAccessRange, error)
	GetAllCIDRs() ([]string, error)
}

type SubscriptionFilter struct {
	Status string
	Page   int
	Limit  int
}
