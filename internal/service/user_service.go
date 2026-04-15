package service

import (
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/graimon31/eanatomy/internal/domain/user"
)

var (
	ErrCannotDeleteSelf   = errors.New("cannot delete own account")
	ErrCannotChangeOwnRole = errors.New("cannot change own role")
)

type UserService struct {
	userRepo user.UserRepository
}

func NewUserService(userRepo user.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) ListUsers(filter user.UserFilter) ([]user.User, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.userRepo.List(filter)
}

func (s *UserService) ChangeRole(currentUserID, targetUserID uuid.UUID, newRole string) error {
	if currentUserID == targetUserID {
		return ErrCannotChangeOwnRole
	}

	validRoles := map[string]bool{
		"super_admin": true,
		"moderator":   true,
		"editor":      true,
		"subscriber":  true,
		"guest":       true,
	}
	if !validRoles[newRole] {
		return fmt.Errorf("invalid role: %s", newRole)
	}

	u, err := s.userRepo.FindByID(targetUserID)
	if err != nil {
		return ErrUserNotFound
	}

	u.Role = user.Role(newRole)
	return s.userRepo.Update(u)
}

func (s *UserService) DeleteUser(currentUserID, targetUserID uuid.UUID) error {
	if currentUserID == targetUserID {
		return ErrCannotDeleteSelf
	}

	_, err := s.userRepo.FindByID(targetUserID)
	if err != nil {
		return ErrUserNotFound
	}

	return s.userRepo.Delete(targetUserID)
}
