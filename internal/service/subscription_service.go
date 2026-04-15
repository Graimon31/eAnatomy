package service

import (
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/graimon31/eanatomy/internal/domain/subscription"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrIPRangeNotFound      = errors.New("IP range not found")
)

type SubscriptionService struct {
	subRepo     subscription.SubscriptionRepository
	ipRangeRepo subscription.IPAccessRangeRepository
}

func NewSubscriptionService(
	subRepo subscription.SubscriptionRepository,
	ipRangeRepo subscription.IPAccessRangeRepository,
) *SubscriptionService {
	return &SubscriptionService{
		subRepo:     subRepo,
		ipRangeRepo: ipRangeRepo,
	}
}

func (s *SubscriptionService) GetStatus(userID uuid.UUID) (*subscription.Subscription, error) {
	return s.subRepo.FindActiveByUserID(userID)
}

func (s *SubscriptionService) CancelSubscription(id uuid.UUID) error {
	sub, err := s.subRepo.FindByID(id)
	if err != nil {
		return ErrSubscriptionNotFound
	}

	sub.Status = subscription.StatusCancelled
	return s.subRepo.Update(sub)
}

func (s *SubscriptionService) ListSubscriptions(filter subscription.SubscriptionFilter) ([]subscription.Subscription, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.subRepo.List(filter)
}

// IP Ranges

func (s *SubscriptionService) ListIPRanges() ([]subscription.IPAccessRange, error) {
	return s.ipRangeRepo.List()
}

type CreateIPRangeInput struct {
	CIDR            string `json:"cidr" binding:"required"`
	InstitutionName string `json:"institution_name"`
	ExpiresAt       string `json:"expires_at"`
}

func (s *SubscriptionService) CreateIPRange(input CreateIPRangeInput) (*subscription.IPAccessRange, error) {
	r := &subscription.IPAccessRange{
		CIDR:            input.CIDR,
		InstitutionName: input.InstitutionName,
	}

	if err := s.ipRangeRepo.Create(r); err != nil {
		return nil, fmt.Errorf("failed to create IP range: %w", err)
	}

	return r, nil
}

func (s *SubscriptionService) DeleteIPRange(id int) error {
	return s.ipRangeRepo.Delete(id)
}

func (s *SubscriptionService) GetAllCIDRs() ([]string, error) {
	return s.ipRangeRepo.GetAllCIDRs()
}
