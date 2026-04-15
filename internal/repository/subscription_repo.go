package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/subscription"
	"gorm.io/gorm"
)

// SubscriptionRepo implements subscription.SubscriptionRepository.
type SubscriptionRepo struct {
	db *gorm.DB
}

func NewSubscriptionRepo(db *gorm.DB) *SubscriptionRepo {
	return &SubscriptionRepo{db: db}
}

func (r *SubscriptionRepo) Create(sub *subscription.Subscription) error {
	return r.db.Create(sub).Error
}

func (r *SubscriptionRepo) FindByID(id uuid.UUID) (*subscription.Subscription, error) {
	var sub subscription.Subscription
	if err := r.db.Where("id = ?", id).First(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepo) FindActiveByUserID(userID uuid.UUID) (*subscription.Subscription, error) {
	var sub subscription.Subscription
	if err := r.db.Where("user_id = ? AND status = ?", userID, subscription.StatusActive).First(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepo) Update(sub *subscription.Subscription) error {
	return r.db.Save(sub).Error
}

func (r *SubscriptionRepo) List(filter subscription.SubscriptionFilter) ([]subscription.Subscription, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	query := r.db.Model(&subscription.Subscription{})

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var subs []subscription.Subscription
	offset := (filter.Page - 1) * filter.Limit
	if err := query.Offset(offset).Limit(filter.Limit).Order("started_at DESC").Find(&subs).Error; err != nil {
		return nil, 0, err
	}

	return subs, total, nil
}

func (r *SubscriptionRepo) FindExpiringSoon(days int) ([]subscription.Subscription, error) {
	deadline := time.Now().AddDate(0, 0, days)
	var subs []subscription.Subscription
	if err := r.db.Where("status = ? AND expires_at <= ?", subscription.StatusActive, deadline).Find(&subs).Error; err != nil {
		return nil, err
	}
	return subs, nil
}

var _ subscription.SubscriptionRepository = (*SubscriptionRepo)(nil)

// IPAccessRangeRepo implements subscription.IPAccessRangeRepository.
type IPAccessRangeRepo struct {
	db *gorm.DB
}

func NewIPAccessRangeRepo(db *gorm.DB) *IPAccessRangeRepo {
	return &IPAccessRangeRepo{db: db}
}

func (r *IPAccessRangeRepo) Create(ar *subscription.IPAccessRange) error {
	return r.db.Create(ar).Error
}

func (r *IPAccessRangeRepo) Delete(id int) error {
	return r.db.Delete(&subscription.IPAccessRange{}, "id = ?", id).Error
}

func (r *IPAccessRangeRepo) List() ([]subscription.IPAccessRange, error) {
	var ranges []subscription.IPAccessRange
	if err := r.db.Find(&ranges).Error; err != nil {
		return nil, err
	}
	return ranges, nil
}

func (r *IPAccessRangeRepo) GetAllCIDRs() ([]string, error) {
	var cidrs []string
	if err := r.db.Model(&subscription.IPAccessRange{}).Pluck("cidr", &cidrs).Error; err != nil {
		return nil, err
	}
	return cidrs, nil
}

var _ subscription.IPAccessRangeRepository = (*IPAccessRangeRepo)(nil)
