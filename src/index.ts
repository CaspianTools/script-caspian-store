// --- Provider ---
export {
  CaspianStoreProvider,
  useCaspianStore,
  useCaspianLink,
  useCaspianImage,
  useCaspianNavigation,
  useCaspianCollections,
  useCaspianFirebase,
  type CaspianStoreProviderProps,
  type CaspianStoreContextValue,
} from './provider/caspian-store-provider';

// --- Hooks / contexts ---
export { useAuth } from './context/auth-context';
export { useCart } from './context/cart-context';
export { useScriptSettings } from './context/script-settings-context';

// --- Framework adapter types (for consumer wiring) ---
export type {
  CaspianLinkProps,
  CaspianLinkComponent,
  CaspianImageProps,
  CaspianImageComponent,
  CaspianNavigation,
  UseCaspianNavigation,
  FrameworkAdapters,
} from './primitives';
export {
  DefaultCaspianLink,
  DefaultCaspianImage,
  useDefaultCaspianNavigation,
} from './primitives';

// --- Single-mount root (v7.0.0) ---
// Mount `<CaspianRoot />` once at `app/[[...slug]]/page.tsx` and the
// library owns every storefront, admin, account, auth, and content URL.
// New library pages land without consumers touching their route tree.
export { CaspianRoot, type CaspianRootProps } from './components/caspian-root';

// --- Storefront components ---
export { StarIcon } from './components/star-icon';
export { StarRatingInput, type StarRatingInputProps } from './components/star-rating-input';
export { ProductCard, type ProductCardProps } from './components/product-card';
export { ProductGrid, type ProductGridProps } from './components/product-grid';
export { ProductListPage, type ProductListPageProps } from './components/product-list-page';
export {
  ShopFilterSidebar,
  EMPTY_SHOP_FILTERS,
  type ShopFilterSidebarProps,
  type ShopFilterState,
} from './components/shop-filter-sidebar';
export { CollectionsPage, type CollectionsPageProps } from './components/collections-page';
export {
  CollectionDetailPage,
  type CollectionDetailPageProps,
} from './components/collection-detail-page';
export { SearchResultsPage, type SearchResultsPageProps } from './components/search-results-page';
export { SearchDialog, type SearchDialogProps } from './components/search-dialog';
export { ProductGallery } from './components/product-gallery';
export {
  SizeSelector,
  QuantitySelector,
  type SizeSelectorProps,
} from './components/product-selectors';
export { ProductDetailPage, type ProductDetailPageProps } from './components/product-detail-page';
export { CartSheet, type CartSheetProps } from './components/cart-sheet';
export { CartPage, type CartPageProps } from './components/cart-page';
export { CheckoutPage, type CheckoutPageProps } from './components/checkout-page';
export {
  OrderConfirmationPage,
  type OrderConfirmationPageProps,
} from './components/order-confirmation-page';
export {
  OrderHistoryList,
  type OrderHistoryListProps,
} from './components/order-history-list';
export { WishlistButton, type WishlistButtonProps } from './components/wishlist-button';

// Site shell (v1.6) — header / footer / layout / favicon
export {
  SiteHeader,
  type SiteHeaderProps,
  type SiteHeaderNavItem,
} from './components/site-header';
export {
  SiteFooter,
  type SiteFooterProps,
  type SiteFooterLink,
} from './components/site-footer';
export { LayoutShell, type LayoutShellProps } from './components/layout-shell';
export {
  ComingSoonSplash,
  type ComingSoonSplashProps,
} from './components/coming-soon-splash';
export { DynamicFavicon } from './components/dynamic-favicon';
export { SocialIcon } from './components/social-icon';

// Homepage surface (v1.2)
export {
  Hero,
  FeaturedCategoriesSection,
  TrendingProductsSection,
  NewsletterSignup,
  HomePage,
  type HeroProps,
  type FeaturedCategoriesSectionProps,
  type TrendingProductsSectionProps,
  type NewsletterSignupProps,
  type HomePageProps,
} from './components/home';

// Journal surface (v1.3)
export {
  JournalListPage,
  JournalDetailPage,
  type JournalListPageProps,
  type JournalDetailPageProps,
} from './components/journal';

// Content-page surface (v1.3)
export {
  PageContentView,
  type PageContentViewProps,
} from './components/content';

// FAQs + shipping + size guide (v1.4)
export { FaqsPage, type FaqsPageProps } from './components/faqs';

// Contact page (v2.13)
export { ContactPage, type ContactPageProps } from './components/contact';
export {
  ShippingReturnsPage,
  type ShippingReturnsPageProps,
} from './components/shipping';
export {
  SizeGuidePage,
  DEFAULT_SIZE_GUIDE,
  type SizeGuidePageProps,
} from './components/size-guide';

// Reviews & Questions
export { ProductReviews, type ReviewSummaryData } from './components/reviews/product-reviews';
export { ReviewSummary } from './components/reviews/review-summary';
export { ReviewList, type ReviewListProps } from './components/reviews/review-list';
export { ReviewItem, type ReviewItemProps } from './components/reviews/review-item';
export { QuestionList } from './components/reviews/question-list';
export { QuestionItem } from './components/reviews/question-item';
export { WriteReviewDialog } from './components/reviews/write-review-dialog';
export { AskQuestionDialog } from './components/reviews/ask-question-dialog';

// Script settings
export {
  ScriptSettingsPage,
  type ScriptSettingsPageProps,
} from './components/script-settings-page';

// Setup wizard (v1.24)
export {
  SetupWizard,
  SetupInitPage,
  SetupShell,
  SetupStepper,
  type SetupWizardProps,
  type SetupInitPageProps,
  type SetupShellProps,
  type SetupStepperProps,
  type SetupStep,
  type WizardDraft,
  type SiteInfoDraft,
  type BrandingDraft,
} from './components/setup';

// Auth pages + account surface
export {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ProfileCard,
  AddressBook,
  ChangePasswordCard,
  ProfilePhotoCard,
  DeleteAccountCard,
  AccountPage,
  WishlistPanel,
  AccountSidebar,
  ACCOUNT_SECTION_ICONS,
  type LoginPageProps,
  type RegisterPageProps,
  type ForgotPasswordPageProps,
  type AccountPageProps,
  type WishlistPanelProps,
  type AccountSidebarProps,
  type AccountSidebarItem,
  type AccountSection,
} from './components/auth';

// Storefront profile menu (v3.2) — avatar + dropdown for signed-in header
export {
  StorefrontProfileMenu,
  type StorefrontProfileMenuProps,
} from './components/storefront-profile-menu';

// i18n
export {
  LocaleProvider,
  useT,
  useLocale,
  useDirection,
  useFormatNumber,
  useFormatCurrency,
  useFormatDate,
  DEFAULT_MESSAGES,
  interpolate,
  isRtl,
  LocaleSwitcher,
  type LocaleProviderProps,
  type TranslateFn,
  type MessageDict,
  type LocaleSwitcherProps,
  type LocaleOption,
} from './i18n';

// Theming presets + rich catalog
export {
  THEME_PRESETS,
  THEME_PRESET_LABELS,
  ThemePresetPicker,
  THEME_CATALOG,
  THEME_CATEGORY_LABELS,
  findCatalogTheme,
  countThemesByCategory,
  ThemeThumbnailSvg,
  DEMO_BRAND,
  DEMO_HERO,
  DEMO_NAV,
  DEMO_PRODUCTS,
  type ThemePresetName,
  type ThemePresetPickerProps,
  type CatalogTheme,
  type ThemeCategory,
  type ThemeThumbnail,
  type ThemeThumbnailProps,
  type DemoProduct,
} from './theme';

// --- UI primitives (consumable) ---
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  Input,
  Textarea,
  Label,
  Dialog,
  type DialogProps,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  Select,
  type SelectProps,
  type SelectOption,
  Skeleton,
  Badge,
  Avatar,
  Separator,
  useToast,
  type ToastMessage,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  ImageUploadField,
  type ImageUploadFieldProps,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  type DropdownMenuProps,
  type DropdownMenuItemProps,
  MoreHorizontalIcon,
  EditIcon,
  TrashIcon,
  ExternalLinkIcon,
  HelpIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
  FieldHelp,
  type FieldHelpProps,
  FieldDescription,
  type FieldDescriptionProps,
  SearchableSelect,
  type SearchableSelectProps,
  type SearchableSelectOption,
  RichTextEditor,
  sanitizeRichHtml,
  HtmlContent,
  type RichTextEditorProps,
  type HtmlContentProps,
} from './ui';

// --- Services ---
export {
  getProducts,
  getProductById,
  getProductsByIds,
  getRelatedProducts,
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductFilters,
  type ProductWriteInput,
} from './services/product-service';
export {
  getApprovedReviewsForProduct,
  hasUserReviewedProduct,
  createReview,
  listAllReviews,
  setReviewStatus,
  deleteReview,
  type ReviewSortBy,
  type CreateReviewInput,
  type CreateReviewAuthor,
} from './services/review-service';
export {
  getApprovedQuestionsForProduct,
  createQuestion,
  listAllQuestions,
  setQuestionStatus,
  answerQuestion,
  deleteQuestion,
  type CreateQuestionInput,
  type CreateQuestionAuthor,
} from './services/question-service';
export {
  hasUserPurchasedProduct,
  getOrderById,
  getOrdersByUser,
  listAllOrders,
  updateOrderStatus,
} from './services/order-service';
export { loadUserCart, saveUserCart } from './services/cart-service';
export { addToWishlist, removeFromWishlist } from './services/wishlist-service';
export {
  updateDisplayName,
  updatePhone,
  updateProfileFields,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from './services/user-service';
export {
  uploadProfilePhoto,
  removeProfilePhoto,
  MAX_PROFILE_PHOTO_BYTES,
  ALLOWED_PROFILE_PHOTO_TYPES,
  type UploadProfilePhotoInput,
} from './services/storage-service';

// --- Client hooks ---
export { useCheckout } from './hooks/use-checkout';
export {
  useProductSearch,
  type UseProductSearchOptions,
  type UseProductSearchResult,
} from './hooks/use-product-search';

// --- Payment plugins ---
export {
  PAYMENT_PLUGIN_IDS,
  PAYMENT_PLUGIN_CATALOG,
  getPaymentPlugin,
  STRIPE_PLUGIN,
  BACS_PLUGIN,
  CHEQUE_PLUGIN,
  COD_PLUGIN,
  type PaymentPluginId,
  type PaymentPlugin,
  type PaymentPluginCheckoutCtx,
  type PaymentPluginStartResult,
  type StartCheckoutOptions,
  type CheckoutShippingInfoInput,
  type StripeConfig,
  type ManualPaymentBaseConfig,
  type BacsConfig,
  type ChequeConfig,
  type CodConfig,
} from './payments';
export {
  listPaymentPluginInstalls,
  createPaymentPluginInstall,
  updatePaymentPluginInstall,
  deletePaymentPluginInstall,
  type PaymentPluginInstallWriteInput,
} from './services/payment-plugin-service';

// --- Email plugins (v2.14) ---
export {
  EMAIL_PLUGIN_IDS,
  EMAIL_PLUGIN_CATALOG,
  getEmailPlugin,
  SENDGRID_PLUGIN,
  BREVO_PLUGIN,
  type EmailPluginId,
  type EmailPlugin,
  type SendGridConfig,
  type BrevoConfig,
} from './email';
export {
  listEmailPluginInstalls,
  createEmailPluginInstall,
  updateEmailPluginInstall,
  deleteEmailPluginInstall,
  type EmailPluginInstallWriteInput,
} from './services/email-plugin-service';

export { useWishlist } from './hooks/use-wishlist';
export {
  validatePromoCode,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  type PromoCodeWriteInput,
} from './services/promo-code-service';
export {
  listActiveCategories,
  getFeaturedCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryWriteInput,
} from './services/category-service';
export {
  listActiveBrands,
  listAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  resolveBrandName,
  migrateLegacyBrandStrings,
  countLegacyBrandStrings,
  type BrandWriteInput,
} from './services/brand-service';
export { useBrands, useBrandName, refreshBrandsCache } from './hooks/use-brands';
export {
  subscribeEmail,
  listSubscribers,
  deleteSubscriber,
  subscribersToCsv,
  type SubscribeResult,
} from './services/subscriber-service';
export {
  createContact,
  listAllContacts,
  listRecentContacts,
  countNewContacts,
  setContactStatus,
  deleteContact,
  type CreateContactInput,
} from './services/contact-service';
export {
  logSearchTerm,
  listSearchTerms,
  deleteSearchTerm,
  clearAllSearchTerms,
  normalizeSearchTerm,
  type SearchTermSortBy,
} from './services/search-term-service';
export {
  listProductCollections,
  getProductCollectionBySlug,
  createProductCollection,
  updateProductCollection,
  deleteProductCollection,
  type ProductCollectionWriteInput,
} from './services/product-collection-service';
export {
  listLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  type LanguageWriteInput,
} from './services/language-service';
export { getSiteSettings, saveSiteSettings } from './services/site-settings-service';
export {
  listAdminTodos,
  createAdminTodo,
  updateAdminTodo,
  deleteAdminTodo,
  listenAdminTodos,
  seedDefaultAdminTodos,
  DEFAULT_ADMIN_TODOS,
  type AdminTodoWriteInput,
} from './services/admin-todo-service';
export {
  verifyAdminTodos,
  AUTO_DETECTABLE_TODO_IDS,
} from './services/admin-todo-detectors';
export {
  listJournalArticles,
  getJournalArticle,
  createJournalArticle,
  updateJournalArticle,
  deleteJournalArticle,
  type JournalArticleWriteInput,
} from './services/journal-service';
export {
  getPageContent,
  listPageContents,
  savePageContent,
  type SavePageContentInput,
} from './services/page-content-service';
export {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  type FaqWriteInput,
} from './services/faq-service';
export {
  listShippingPluginInstalls,
  createShippingPluginInstall,
  updateShippingPluginInstall,
  deleteShippingPluginInstall,
  type ShippingPluginInstallWriteInput,
} from './services/shipping-plugin-service';
export {
  calculateShippingRates,
  type CalculateShippingRatesInput,
} from './services/shipping-calculator';
export {
  SHIPPING_PLUGIN_CATALOG,
  SHIPPING_PLUGIN_IDS,
  getShippingPlugin,
  FLAT_RATE_PLUGIN,
  FREE_SHIPPING_PLUGIN,
  FREE_OVER_THRESHOLD_PLUGIN,
  WEIGHT_BASED_PLUGIN,
  type ShippingPlugin,
  type ShippingPluginId,
  type ShippingRate,
  type CalculationContext,
  type PluginDescribeContext,
  type FlatRateConfig,
  type FreeShippingConfig,
  type FreeOverThresholdConfig,
  type WeightBasedConfig,
} from './shipping';
export { ShippingRatePicker, type ShippingRatePickerProps } from './components/checkout';
export {
  uploadAdminImage,
  deleteStorageObject,
  diagnoseUploadDenial,
  tryEnsureAdminClaim,
  type UploadDenialDiagnosis,
} from './services/storage-service';

// --- Admin surface ---
export {
  AdminGuard,
  AdminShell,
  AdminSettingsShell,
  AdminRoot,
  AdminPluginsPage,
  AdminPluginInstallPage,
  AdminShippingOptionsPage,
  useEnabledPluginInstalls,
  DEFAULT_ADMIN_NAV,
  SETTINGS_SUB_NAV,
  AdminDashboard,
  AdminProductsList,
  AdminProductEditor,
  AdminOrdersList,
  AdminOrderDetail,
  AdminReviewsModeration,
  AdminJournalPage,
  AdminPagesPage,
  AdminFaqsPage,
  AdminEmailsPage,
  AdminEmailPluginsPage,
  AdminShippingPluginsPage,
  AdminPaymentPluginsPage,
  AdminPromoCodesPage,
  AdminSubscribersPage,
  AdminUsersPage,
  AdminContactsPage,
  AdminContactsList,
  AdminProductBrandsPage,
  AdminProductCategoriesPage,
  AdminProductCollectionsPage,
  AdminLanguagesPage,
  AdminSiteSettingsPage,
  CountryPickerDialog,
  ISO_COUNTRIES,
  AdminAppearancePage,
  AdminAppearancePreviewPage,
  AdminOnboardingProgress,
  AdminAboutPage,
  AdminNotificationsBell,
  AdminProfileMenu,
  DEFAULT_PAGE_KEYS,
  type AdminGuardProps,
  type AdminShellProps,
  type AdminSettingsShellProps,
  type AdminPluginsPageProps,
  type AdminPluginInstallPageProps,
  type AdminShippingOptionsPageProps,
  type AdminShippingPluginsPageProps,
  type AdminPaymentPluginsPageProps,
  type EnabledPluginInstall,
  type EnabledPluginCategory,
  type AdminNavItem,
  type AdminNavLeaf,
  type AdminNavGroup,
  type AdminDashboardProps,
  type AdminProductsListProps,
  type AdminProductEditorProps,
  type AdminOrdersListProps,
  type AdminOrderDetailProps,
  type AdminPagesPageProps,
  type AdminFaqsPageProps,
  type AdminAboutPageProps,
  type AdminNotificationsBellProps,
  type AdminAppearancePageProps,
  type AdminAppearancePreviewPageProps,
  type CountryPickerDialogProps,
  type IsoCountry,
  type AdminProfileMenuProps,
  type AdminOnboardingProgressProps,
  type AdminEmailsPageProps,
  type AdminEmailPluginsPageProps,
  type AdminUsersPageProps,
  type AdminContactsPageProps,
  type AdminContactsListProps,
} from './admin';

// --- Types ---
export type {
  Product,
  ProductImage,
  ColorVariant,
  UserProfile,
  UserAddress,
  OrderStatus,
  ModerationStatus,
  FirestoreReview,
  FirestoreQuestion,
  CartItemRef,
  CartItem,
  FirestoreCart,
  Order,
  OrderItem,
  OrderPayment,
  ShippingInfo,
  ScriptSettings,
  ThemeTokens,
  FontTokens,
  HeroTokens,
  SizeTableRow,
  SizeTable,
  SizeGuideConfig,
  FeatureFlags,
  // v1.1 additions — Firestore admin types
  FaqItem,
  JournalArticle,
  Subscriber,
  SocialLink,
  SocialPlatform,
  SiteSettings,
  SupportedCountry,
  TaxMode,
  PromoCode,
  AppliedPromoCode,
  SearchTerm,
  ShippingPluginInstall,
  ProductCategoryDoc,
  ProductBrandDoc,
  ProductCollectionDoc,
  PageContent,
  LanguageDoc,
  AdminTodo,
  PaymentPluginInstall,
  EmailPluginInstall,
  // v2.7 additions — admin-editable runtime behavior
  ComingSoonSettings,
  CurrencyDisplay,
  StoreAddress,
  ReviewPolicy,
  CartBehavior,
  // v2.9 additions — inventory + shipping display
  InventorySettings,
  ShippingOptions,
  // v2.10 additions — accounts + privacy
  AccountSettings,
  PrivacyRetentionSettings,
  // v2.11 additions — transactional emails
  EmailSettings,
  EmailTemplate,
  EmailTemplateKey,
  EmailAudience,
  // v2.12 additions — tax display/calc options
  TaxConfig,
  // v2.13 additions — contact submissions
  ContactSubmission,
  ContactStatus,
} from './types';
export { EMAIL_TEMPLATE_KEYS } from './types';
export {
  getEmailSettings,
  saveEmailSettings,
  listEmailTemplates,
  saveEmailTemplate,
  sendTestEmail,
  DEFAULT_EMAIL_SETTINGS,
  EMAIL_TEMPLATE_AUDIENCE,
  EMAIL_TEMPLATE_LABELS,
  type SaveEmailTemplateInput,
  type SendTestEmailInput,
} from './services/email-service';
export { DEFAULT_SCRIPT_SETTINGS, SOCIAL_PLATFORMS } from './types';

// --- Error logging (mod1182) ---
export { ErrorBoundary, type ErrorBoundaryProps } from './components/error-boundary';
export {
  logError,
  listRecentErrors,
  dismissError,
  reportServiceError,
  buildUpstreamIssueUrl,
  UPSTREAM_ISSUE_URL_LIMIT,
  type LogErrorInput,
} from './services/error-log-service';
export { redactError, redactString } from './utils/redact-error';
export type { ErrorLog, ErrorLogSource } from './types';

// --- Utilities ---
export { cn } from './utils/cn';
export { slugify } from './utils/slugify';
export {
  formatCurrency,
  currencySymbol,
  defaultCurrencyDisplay,
  type FormatCurrencyOptions,
} from './utils/format-currency';
export {
  getSubdivisions,
  SUBDIVISION_LIBRARY,
  type Subdivision,
} from './data/subdivisions';
export {
  DEFAULT_INVENTORY_SETTINGS,
  totalStock,
  isProductOutOfStock,
  isSizeOutOfStock,
  resolveStockBadge,
  type StockBadgeKind,
} from './utils/inventory';
export {
  ALL_COUNTRIES,
  toCountryOptions,
  countryName,
  findCountryCode,
} from './utils/countries';
export {
  DEFAULT_TAX_CONFIG,
  resolveTaxCountryCode,
  renderPriceSuffix,
} from './utils/tax';

// --- Library metadata ---
export { CASPIAN_STORE_VERSION } from './version';
export {
  fetchRecentReleases,
  compareVersions,
  isUpdateAvailable,
  DEFAULT_REPO_OWNER,
  DEFAULT_REPO_NAME,
  type GithubRelease,
} from './services/github-updates-service';
export {
  triggerSelfUpdate,
  type SelfUpdateResult,
} from './services/self-update-service';
export {
  useAdminNotifications,
  type AdminNotification,
  type AdminNotificationKind,
  type UseAdminNotificationsOptions,
  type UseAdminNotificationsResult,
} from './hooks/use-admin-notifications';
