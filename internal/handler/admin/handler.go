package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/graimon31/eanatomy/internal/domain/annotation"
	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/domain/subscription"
	"github.com/graimon31/eanatomy/internal/domain/user"
	"github.com/graimon31/eanatomy/internal/service"
)

type AdminHandler struct {
	userService         *service.UserService
	moduleService       *service.ModuleService
	annotationService   *service.AnnotationService
	subscriptionService *service.SubscriptionService
}

func NewAdminHandler(
	userService *service.UserService,
	moduleService *service.ModuleService,
	annotationService *service.AnnotationService,
	subscriptionService *service.SubscriptionService,
) *AdminHandler {
	return &AdminHandler{
		userService:         userService,
		moduleService:       moduleService,
		annotationService:   annotationService,
		subscriptionService: subscriptionService,
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func getUserID(c *gin.Context) (uuid.UUID, bool) {
	val, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"detail": "unauthorized",
			"code":   "UNAUTHORIZED",
		})
		return uuid.UUID{}, false
	}
	uid, ok := val.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "invalid user ID in context",
			"code":   "INTERNAL_ERROR",
		})
		return uuid.UUID{}, false
	}
	return uid, true
}

func getRole(c *gin.Context) (string, bool) {
	val, ok := c.Get("role")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"detail": "unauthorized",
			"code":   "UNAUTHORIZED",
		})
		return "", false
	}
	role, ok := val.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "invalid role in context",
			"code":   "INTERNAL_ERROR",
		})
		return "", false
	}
	return role, true
}

func requireSuperAdmin(c *gin.Context) bool {
	role, ok := getRole(c)
	if !ok {
		return false
	}
	if role != string(user.RoleSuperAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"detail": "super_admin role required",
			"code":   "FORBIDDEN",
		})
		return false
	}
	return true
}

func requireModerator(c *gin.Context) bool {
	role, ok := getRole(c)
	if !ok {
		return false
	}
	if role != string(user.RoleSuperAdmin) && role != string(user.RoleModerator) {
		c.JSON(http.StatusForbidden, gin.H{
			"detail": "moderator or super_admin role required",
			"code":   "FORBIDDEN",
		})
		return false
	}
	return true
}

func parsePagination(c *gin.Context) (int, int) {
	page := 1
	limit := 20

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	return page, limit
}

// ---------------------------------------------------------------------------
// Users (super_admin only)
// ---------------------------------------------------------------------------

func (h *AdminHandler) ListUsers(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	page, limit := parsePagination(c)

	filter := user.UserFilter{
		Role:   c.Query("role"),
		Search: c.Query("search"),
		Page:   page,
		Limit:  limit,
	}

	users, total, err := h.userService.ListUsers(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list users",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *AdminHandler) ChangeRole(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	currentUserID, ok := getUserID(c)
	if !ok {
		return
	}

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid user ID",
			"code":   "INVALID_ID",
		})
		return
	}

	var input struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	err = h.userService.ChangeRole(currentUserID, targetID, input.Role)
	if err != nil {
		switch err {
		case service.ErrCannotChangeOwnRole:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "CANNOT_CHANGE_OWN_ROLE",
			})
		case service.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "USER_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "CHANGE_ROLE_FAILED",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "role updated"})
}

func (h *AdminHandler) DeleteUser(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	currentUserID, ok := getUserID(c)
	if !ok {
		return
	}

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid user ID",
			"code":   "INVALID_ID",
		})
		return
	}

	err = h.userService.DeleteUser(currentUserID, targetID)
	if err != nil {
		switch err {
		case service.ErrCannotDeleteSelf:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "CANNOT_DELETE_SELF",
			})
		case service.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "USER_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to delete user",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "user deleted"})
}

// ---------------------------------------------------------------------------
// Modules (moderator+)
// ---------------------------------------------------------------------------

func (h *AdminHandler) ListModules(c *gin.Context) {
	if !requireModerator(c) {
		return
	}

	page, limit := parsePagination(c)

	filter := module.ModuleFilter{
		Status: c.Query("status"),
		Lang:   c.Query("lang"),
		Page:   page,
		Limit:  limit,
	}

	if rid := c.Query("region_id"); rid != "" {
		if v, err := strconv.Atoi(rid); err == nil {
			filter.RegionID = v
		}
	}
	if mid := c.Query("modality_id"); mid != "" {
		if v, err := strconv.Atoi(mid); err == nil {
			filter.ModalityID = v
		}
	}

	modules, total, err := h.moduleService.ListModules(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list modules",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": modules,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *AdminHandler) PublishModule(c *gin.Context) {
	if !requireModerator(c) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid module ID",
			"code":   "INVALID_ID",
		})
		return
	}

	m, err := h.moduleService.PublishModule(id)
	if err != nil {
		switch err {
		case service.ErrModuleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_FOUND",
			})
		case service.ErrModuleNotReview:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_IN_REVIEW",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to publish module",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, m)
}

func (h *AdminHandler) RejectModule(c *gin.Context) {
	if !requireModerator(c) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid module ID",
			"code":   "INVALID_ID",
		})
		return
	}

	var input service.RejectModuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	m, err := h.moduleService.RejectModule(id, input.Reason)
	if err != nil {
		switch err {
		case service.ErrModuleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_FOUND",
			})
		case service.ErrModuleNotReview:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_IN_REVIEW",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to reject module",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, m)
}

func (h *AdminHandler) DeleteModule(c *gin.Context) {
	if !requireModerator(c) {
		return
	}

	userID, ok := getUserID(c)
	if !ok {
		return
	}

	role, ok := getRole(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid module ID",
			"code":   "INVALID_ID",
		})
		return
	}

	err = h.moduleService.DeleteModule(id, userID, role)
	if err != nil {
		switch err {
		case service.ErrModuleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_FOUND",
			})
		case service.ErrNotModuleOwner:
			c.JSON(http.StatusForbidden, gin.H{
				"detail": err.Error(),
				"code":   "NOT_MODULE_OWNER",
			})
		case service.ErrModuleNotDraft:
			c.JSON(http.StatusBadRequest, gin.H{
				"detail": err.Error(),
				"code":   "MODULE_NOT_DRAFT",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to delete module",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "module deleted"})
}

// ---------------------------------------------------------------------------
// Terms (super_admin)
// ---------------------------------------------------------------------------

func (h *AdminHandler) ListTerms(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	page, limit := parsePagination(c)

	filter := annotation.TermFilter{
		Search: c.Query("search"),
		Page:   page,
		Limit:  limit,
	}

	if cid := c.Query("category_id"); cid != "" {
		if v, err := strconv.Atoi(cid); err == nil {
			filter.CategoryID = v
		}
	}

	terms, total, err := h.annotationService.ListTerms(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list terms",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": terms,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *AdminHandler) CreateTerm(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input service.CreateTermInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	term, err := h.annotationService.CreateTerm(input, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to create term",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, term)
}

func (h *AdminHandler) UpdateTerm(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid term ID",
			"code":   "INVALID_ID",
		})
		return
	}

	var input service.UpdateTermInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	term, err := h.annotationService.UpdateTerm(id, input)
	if err != nil {
		switch err {
		case service.ErrTermNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "TERM_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to update term",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, term)
}

func (h *AdminHandler) DeleteTerm(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid term ID",
			"code":   "INVALID_ID",
		})
		return
	}

	err = h.annotationService.DeleteTerm(id)
	if err != nil {
		switch err {
		case service.ErrTermNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "TERM_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to delete term",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "term deleted"})
}

func (h *AdminHandler) ImportTermsCSV(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	userID, ok := getUserID(c)
	if !ok {
		return
	}

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "CSV file is required",
			"code":   "FILE_REQUIRED",
		})
		return
	}
	defer file.Close()

	count, err := h.annotationService.ImportTermsCSV(file, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to import terms: " + err.Error(),
			"code":   "IMPORT_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"detail":   "terms imported",
		"imported": count,
	})
}

// ---------------------------------------------------------------------------
// IP Ranges (super_admin)
// ---------------------------------------------------------------------------

func (h *AdminHandler) ListIPRanges(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	ranges, err := h.subscriptionService.ListIPRanges()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list IP ranges",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": ranges})
}

func (h *AdminHandler) CreateIPRange(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	var input service.CreateIPRangeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	r, err := h.subscriptionService.CreateIPRange(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to create IP range",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, r)
}

func (h *AdminHandler) DeleteIPRange(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid IP range ID",
			"code":   "INVALID_ID",
		})
		return
	}

	err = h.subscriptionService.DeleteIPRange(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to delete IP range",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "IP range deleted"})
}

// ---------------------------------------------------------------------------
// Subscriptions (super_admin)
// ---------------------------------------------------------------------------

func (h *AdminHandler) ListSubscriptions(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	page, limit := parsePagination(c)

	filter := subscription.SubscriptionFilter{
		Status: c.Query("status"),
		Page:   page,
		Limit:  limit,
	}

	subs, total, err := h.subscriptionService.ListSubscriptions(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list subscriptions",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": subs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *AdminHandler) CancelSubscription(c *gin.Context) {
	if !requireSuperAdmin(c) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid subscription ID",
			"code":   "INVALID_ID",
		})
		return
	}

	err = h.subscriptionService.CancelSubscription(id)
	if err != nil {
		switch err {
		case service.ErrSubscriptionNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "SUBSCRIPTION_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to cancel subscription",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"detail": "subscription cancelled"})
}
