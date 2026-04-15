package public

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/service"
)

type PublicHandler struct {
	moduleService     *service.ModuleService
	annotationService *service.AnnotationService
	regionService     *service.RegionService
	redis             *redis.Client
}

func NewPublicHandler(
	moduleSvc *service.ModuleService,
	annotationSvc *service.AnnotationService,
	regionSvc *service.RegionService,
	rdb *redis.Client,
) *PublicHandler {
	return &PublicHandler{
		moduleService:     moduleSvc,
		annotationService: annotationSvc,
		regionService:     regionSvc,
		redis:             rdb,
	}
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

// ListRegions returns all regions, cached in Redis for 1 hour.
func (h *PublicHandler) ListRegions(c *gin.Context) {
	ctx := context.Background()
	cacheKey := "cache:regions"

	if cached, err := h.redis.Get(ctx, cacheKey).Bytes(); err == nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	regions, err := h.regionService.ListRegions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list regions",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	data, _ := json.Marshal(gin.H{"items": regions})
	h.redis.Set(ctx, cacheKey, data, 1*time.Hour)

	c.JSON(http.StatusOK, gin.H{"items": regions})
}

// ListModalities returns all modalities, cached in Redis for 1 hour.
func (h *PublicHandler) ListModalities(c *gin.Context) {
	ctx := context.Background()
	cacheKey := "cache:modalities"

	if cached, err := h.redis.Get(ctx, cacheKey).Bytes(); err == nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	modalities, err := h.regionService.ListModalities()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list modalities",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	data, _ := json.Marshal(gin.H{"items": modalities})
	h.redis.Set(ctx, cacheKey, data, 1*time.Hour)

	c.JSON(http.StatusOK, gin.H{"items": modalities})
}

// ListModules returns published modules with optional filters.
func (h *PublicHandler) ListModules(c *gin.Context) {
	page, limit := parsePagination(c)

	filter := module.ModuleFilter{
		Status: "published",
		Lang:   c.Query("lang"),
		Page:   page,
		Limit:  limit,
	}

	if rid := c.Query("region"); rid != "" {
		if v, err := strconv.Atoi(rid); err == nil {
			filter.RegionID = v
		}
	}
	if mid := c.Query("modality"); mid != "" {
		if v, err := strconv.Atoi(mid); err == nil {
			filter.ModalityID = v
		}
	}
	if access := c.Query("access"); access != "" {
		filter.AccessLevel = access
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

// GetModule returns module metadata by slug.
// For premium modules without access: returns locked=true with preview_slices=3.
func (h *PublicHandler) GetModule(c *gin.Context) {
	slug := c.Param("slug")

	m, err := h.moduleService.GetModuleBySlug(slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"detail": "module not found",
			"code":   "NOT_FOUND",
		})
		return
	}

	if m.Status != module.StatusPublished {
		c.JSON(http.StatusNotFound, gin.H{
			"detail": "module not found",
			"code":   "NOT_FOUND",
		})
		return
	}

	if m.AccessLevel == module.AccessPremium && !hasPremiumAccess(c) {
		c.JSON(http.StatusOK, gin.H{
			"module":         m,
			"locked":         true,
			"preview_slices": 3,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"module": m,
		"locked": false,
	})
}

// GetModuleSlices returns slices for a module.
// Premium content without access: only first 3 slices.
func (h *PublicHandler) GetModuleSlices(c *gin.Context) {
	slug := c.Param("slug")

	m, err := h.moduleService.GetModuleBySlug(slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"detail": "module not found",
			"code":   "NOT_FOUND",
		})
		return
	}

	if m.Status != module.StatusPublished {
		c.JSON(http.StatusNotFound, gin.H{
			"detail": "module not found",
			"code":   "NOT_FOUND",
		})
		return
	}

	// Determine projection filter
	var projectionID int
	if m.Projections != nil && len(m.Projections) > 0 {
		projectionID = m.Projections[0].ID
		if pStr := c.Query("projection"); pStr != "" {
			if v, err := strconv.Atoi(pStr); err == nil {
				projectionID = v
			}
		}
	}

	if projectionID == 0 {
		c.JSON(http.StatusOK, gin.H{"items": []interface{}{}, "total": 0})
		return
	}

	slices, err := h.moduleService.ListSlices(projectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list slices",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	// Premium restriction: only 3 preview slices
	isPremium := m.AccessLevel == module.AccessPremium
	hasAccess := hasPremiumAccess(c)

	if isPremium && !hasAccess && len(slices) > 3 {
		slices = slices[:3]
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  slices,
		"total":  len(slices),
		"locked": isPremium && !hasAccess,
	})
}

// GetSliceAnnotations returns annotations for a slice.
func (h *PublicHandler) GetSliceAnnotations(c *gin.Context) {
	sliceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"detail": "invalid slice ID",
			"code":   "INVALID_ID",
		})
		return
	}

	annotations, err := h.annotationService.ListBySlice(sliceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "failed to list annotations",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	// Format response with translations
	lang := c.DefaultQuery("lang", "en")
	var result []gin.H
	for _, a := range annotations {
		item := gin.H{
			"id": a.ID,
			"x":  a.X,
			"y":  a.Y,
		}

		if a.Term != nil {
			termName := extractTranslation(a.Term.Translations, lang)
			item["term_name"] = termName

			if a.Term.Category != nil {
				item["category"] = extractTranslation(a.Term.Category.NameTranslations, lang)
				item["color_hex"] = a.Term.Category.ColorHex
			}
		}

		result = append(result, item)
	}

	if result == nil {
		result = []gin.H{}
	}

	c.JSON(http.StatusOK, result)
}

// Search performs full-text search across terms and modules.
func (h *PublicHandler) Search(c *gin.Context) {
	query := c.Query("q")
	lang := c.DefaultQuery("lang", "en")
	limit := 10
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	terms, err := h.annotationService.SearchTerms(query, lang, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "search failed",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"terms": terms,
	})
}

// Autocomplete provides fast term suggestions.
func (h *PublicHandler) Autocomplete(c *gin.Context) {
	query := c.Query("q")
	lang := c.DefaultQuery("lang", "en")
	limit := 10
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	terms, err := h.annotationService.AutocompleteTerms(query, lang, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "autocomplete failed",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"terms": terms,
	})
}

// GetSubscriptionStatus returns the subscription status for the authenticated user.
func (h *PublicHandler) GetSubscriptionStatus(c *gin.Context) {
	subActive, _ := c.Get("subscriptionActive")
	isActive, _ := subActive.(bool)

	c.JSON(http.StatusOK, gin.H{
		"active": isActive,
	})
}

// hasPremiumAccess checks if the current request has premium access
// (either via subscription or IP-based institutional access).
func hasPremiumAccess(c *gin.Context) bool {
	if active, exists := c.Get("subscriptionActive"); exists {
		if isActive, ok := active.(bool); ok && isActive {
			return true
		}
	}
	return false
}

// extractTranslation extracts a translation for the given language from JSONB data.
func extractTranslation(data []byte, lang string) string {
	if data == nil {
		return ""
	}

	var translations map[string]string
	if err := json.Unmarshal(data, &translations); err != nil {
		return ""
	}

	if val, ok := translations[lang]; ok {
		return val
	}
	if val, ok := translations["en"]; ok {
		return val
	}
	for _, v := range translations {
		return v
	}
	return ""
}
