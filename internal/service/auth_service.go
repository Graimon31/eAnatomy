package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/graimon31/eanatomy/internal/domain/subscription"
	"github.com/graimon31/eanatomy/internal/domain/user"
	"github.com/graimon31/eanatomy/internal/middleware"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailExists        = errors.New("email already registered")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type AuthService struct {
	userRepo  user.UserRepository
	subRepo   subscription.SubscriptionRepository
	redis     *redis.Client
	jwtCfg    middleware.JWTConfig
}

func NewAuthService(
	userRepo user.UserRepository,
	subRepo subscription.SubscriptionRepository,
	redis *redis.Client,
	jwtSecret string,
	accessTTL, refreshTTL time.Duration,
) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		subRepo:  subRepo,
		redis:    redis,
		jwtCfg: middleware.JWTConfig{
			Secret:     jwtSecret,
			AccessTTL:  accessTTL,
			RefreshTTL: refreshTTL,
		},
	}
}

type RegisterInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	User         *user.User `json:"user"`
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
}

type UpdateProfileInput struct {
	Name        string `json:"name"`
	Institution string `json:"institution"`
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	existing, _ := s.userRepo.FindByEmail(input.Email)
	if existing != nil {
		return nil, ErrEmailExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	u := &user.User{
		Email:        input.Email,
		PasswordHash: string(hash),
		Role:         user.RoleGuest,
		Name:         input.Name,
		IsActive:     true,
	}

	if err := s.userRepo.Create(u); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return s.generateTokens(u, false)
}

func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	u, err := s.userRepo.FindByEmail(input.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	if !u.IsActive {
		return nil, errors.New("account is deactivated")
	}

	subActive := false
	sub, _ := s.subRepo.FindActiveByUserID(u.ID)
	if sub != nil {
		subActive = true
	}

	return s.generateTokens(u, subActive)
}

func (s *AuthService) RefreshTokens(refreshToken string) (*AuthResponse, error) {
	claims, err := middleware.ParseToken(refreshToken, s.jwtCfg.Secret)
	if err != nil {
		return nil, ErrInvalidToken
	}

	ctx := context.Background()
	storedToken, err := s.redis.Get(ctx, "refresh:"+claims.UserID.String()).Result()
	if err != nil || storedToken != refreshToken {
		return nil, ErrInvalidToken
	}

	u, err := s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	subActive := false
	sub, _ := s.subRepo.FindActiveByUserID(u.ID)
	if sub != nil {
		subActive = true
	}

	return s.generateTokens(u, subActive)
}

func (s *AuthService) Logout(refreshToken string) error {
	claims, err := middleware.ParseToken(refreshToken, s.jwtCfg.Secret)
	if err != nil {
		return nil
	}

	ctx := context.Background()
	if err := s.redis.Del(ctx, "refresh:"+claims.UserID.String()).Err(); err != nil {
		return fmt.Errorf("failed to invalidate refresh token: %w", err)
	}
	return nil
}

func (s *AuthService) GetCurrentUser(userID uuid.UUID) (*user.User, error) {
	return s.userRepo.FindByID(userID)
}

func (s *AuthService) UpdateProfile(userID uuid.UUID, input UpdateProfileInput) (*user.User, error) {
	u, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if input.Name != "" {
		u.Name = input.Name
	}
	if input.Institution != "" {
		u.Institution = input.Institution
	}

	if err := s.userRepo.Update(u); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	return u, nil
}

func (s *AuthService) generateTokens(u *user.User, subActive bool) (*AuthResponse, error) {
	accessToken, err := middleware.GenerateAccessToken(s.jwtCfg, u.ID, string(u.Role), subActive)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := middleware.GenerateRefreshToken(s.jwtCfg, u.ID, string(u.Role), subActive)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	ctx := context.Background()
	if err := s.redis.Set(ctx, "refresh:"+u.ID.String(), refreshToken, s.jwtCfg.RefreshTTL).Err(); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		User:         u,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}
