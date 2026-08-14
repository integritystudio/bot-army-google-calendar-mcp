/** Gmail user ID (special value 'me' = authenticated user) */
export const USER_ID = 'me';

/** Gmail system label IDs */
export const GMAIL_INBOX = 'INBOX';

/** Gmail label names for email categories */
export const LABEL_SENTRY = 'Sentry Alerts';
export const LABEL_PRODUCT_UPDATES = 'Product Updates';
// TurboTax and Experian promo mail combined under one label — tax prep and credit
// monitoring upsells, distinct enough from the rest of Product Updates to keep
// separate, not distinct enough from each other to warrant two labels.
export const LABEL_PRODUCT_UPDATES_CREDIT_REPORT = 'Product Updates/Credit Report';
export const LABEL_PRODUCT_UPDATES_CHATGPT = 'Product Updates/ChatGPT Tasks';
/** Release notes and feature announcements from developer tooling (hosting, VCS, orchestration, diagramming) */
export const LABEL_PRODUCT_UPDATES_DEV_TOOLS = 'Product Updates/Developer-Tools';
/** Data platform and analytics product mail — distinct from the developer tooling above */
export const LABEL_PRODUCT_UPDATES_DATA = 'Product Updates/Data-Analytics';
export const LABEL_COMMUNITIES = 'Communities';
export const LABEL_SERVICES = 'Services & Alerts';
export const LABEL_SERVICES_REAL_ESTATE = 'Services & Alerts/Real Estate';
export const LABEL_SERVICES_HEALTH = 'Services & Alerts/Health';
export const LABEL_SERVICES_HOME = 'Services & Alerts/Home';
export const LABEL_PURCHASES_AMAZON = 'Purchases/Amazon';
export const LABEL_SERVICES_UTILITIES = 'Services & Alerts/Utilities';
export const LABEL_KEEP_IMPORTANT = 'Keep Important';
export const LABEL_TIME_SENSITIVE = 'Time Sensitive';
export const LABEL_KEEP_REFUNDS = 'Keep Important/Refund Confirmations';
export const LABEL_EVENTS = 'Events';
export const LABEL_MONITORING = 'Monitoring';
export const LABEL_BILLING = 'Billing';
export const LABEL_BILLING_CREDIT_MONITORING = 'Billing/Credit Monitoring';
export const LABEL_BILLING_MARKET_ALERTS = 'Billing/Market Alerts';
export const LABEL_BILLING_ACCOUNT_SECURITY = 'Billing/Account & Security';
export const LABEL_SECURITY_ACCOUNT = 'Security & Account';
export const LABEL_VOICEMAIL = 'Voice Mail';
export const LABEL_BILLING_RECEIPTS = 'Billing/Receipts';
export const LABEL_BILLING_STATEMENTS = 'Billing/Statements';
export const LABEL_BILLING_INVOICES = 'Billing/Invoices';
export const LABEL_COMMUNITY_EVENTS = 'Community Events';
export const LABEL_CALENDLY_NOTIFICATIONS = 'Calendly Notifications';
export const LABEL_LINKEDIN_UPDATES = 'LinkedIn Updates';
export const LABEL_DMARC_REPORTS = 'DMARC Reports';
export const LABEL_MEETING_NOTES = 'Meeting Notes';
export const LABEL_CCV = 'CCV';
export const LABEL_UPDATES = 'Updates';
export const LABEL_ORG_GOOGLE_WORKSPACE = 'Organization: Google Workspace';
export const LABEL_PERFORMANCE_TRACKING = 'Performance Tracking';
export const LABEL_SOCIAL = 'Social';
export const LABEL_MEETING_TRANSCRIPTS = 'Meeting Transcripts';
export const LABEL_EVENTS_COMMUNITY = 'Events/Community';
export const LABEL_EVENTS_INVITATIONS_WORK = 'Events/Invitations/Work';
export const LABEL_EVENTS_WORKSHOPS = 'Events/Workshops';
export const LABEL_EVENTS_INVITATIONS_COMMUNITY_SERVICES = 'Events/Invitations/Community Services';
export const LABEL_EVENTS_MEETUP = 'Events/Meetup';
export const LABEL_EVENTS_CALENDLY = 'Events/Calendly';
export const LABEL_EVENTS_INVITATIONS = 'Events/Invitations';
export const LABEL_EVENTS_INVITATIONS_PROFESSIONAL = 'Events/Invitations/Professional';
export const LABEL_EVENTS_INVITATIONS_CONFERENCES = 'Events/Invitations/Conferences';
export const LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS = 'Events/Community/Creative-Arts';
export const LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL = 'Events/Community/Tech-Professional';
export const LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS = 'Events/Community/Spiritual-Wellness';
export const LABEL_EVENTS_COMMUNITY_NETWORKING = 'Events/Community/Networking';
export const LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION = 'Events/Community/Learning-Education';
export const LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION = 'Events/Community/Social-Recreation';
export const LABEL_EVENTS_COMMUNITY_FOOD_DINING = 'Events/Community/Food-Dining';
export const LABEL_NEWSLETTERS = 'Newsletters';
export const LABEL_NEWSLETTERS_SUBJECT_BASED = 'Newsletters/Subject-Based';
export const LABEL_NEWSLETTERS_CIVIC_AUSTIN = 'Newsletters/Civic/Austin';
export const LABEL_NEWSLETTERS_DEVELOPER = 'Newsletters/Developer';
/** General-interest news publications — distinct from the trade press sublabels below */
export const LABEL_NEWSLETTERS_NEWS = 'Newsletters/News';
/** Legal trade press (ALM properties, Law.com) */
export const LABEL_NEWSLETTERS_LEGAL = 'Newsletters/Legal';
/** Career and personal-growth newsletters */
export const LABEL_NEWSLETTERS_PERSONAL_DEV = 'Newsletters/Personal Development';
export const LABEL_NETWORKING = 'Networking';
export const LABEL_NEWSLETTERS_LINKEDIN = 'Newsletters/LinkedIn';
export const LABEL_NEWSLETTERS_CCV = 'Newsletters/CCV';
export const LABEL_FORUMS = 'Forums';
export const LABEL_FORUMS_LINKEDIN_SOCIAL = 'Forums/LinkedIn Social';
export const LABEL_FORUMS_GLASSDOOR = 'Forums/Glassdoor';
export const LABEL_JOB_SEARCH = 'Job Search';
export const LABEL_JOB_SEARCH_LINKEDIN = 'Job Search/LinkedIn';
export const LABEL_JOB_SEARCH_GLASSDOOR = 'Job Search/Glassdoor';
export const LABEL_JOB_SEARCH_BACKSTAGE = 'Job Search/Backstage';
export const LABEL_JOB_SEARCH_INDEED = 'Job Search/Indeed';
export const LABEL_JOB_SEARCH_OTHER = 'Job Search/Other';
export const LABEL_EVENTS_APA = 'Events/Austin Pets Alive';
export const LABEL_EVENTS_LUMA = 'Events/Luma';
export const LABEL_EVENTS_CALENDAR_NOTIFICATIONS = 'Events/Calendar Notifications';
export const LABEL_EVENTS_DANCE = 'Events/Dance';
export const LABEL_EVENTS_PERSONAL = 'Events/Personal';
export const LABEL_EVENTS_EVENTBRITE = 'Events/Eventbrite';
export const LABEL_EVENTS_IMPORTANT = 'Events/Important';
export const LABEL_EVENTS_LOCAL = 'Events/Local';
export const LABEL_EVENTS_PERFORMANCES = 'Events/Performances';
export const LABEL_EVENTS_ENTERTAINMENT = 'Events/Entertainment';
export const LABEL_EVENTS_AI_MONTHLY = 'Events/AI Monthly';
export const LABEL_EVENTS_CONVENTIONS_TECH = 'Events/Conventions/Tech';
export const LABEL_EVENTS_TECH = 'Events/Tech';
export const LABEL_EVENTS_CLASSES = 'Events/Classes';
export const LABEL_TRAVEL = 'Travel';
export const LABEL_TRAVEL_AIRBNB_RESERVATIONS = 'Travel/Airbnb Reservations';
export const LABEL_TRAVEL_AIRBNB_SUPPORT = 'Travel/Airbnb Support';
export const LABEL_PROMOTIONS_TRAVEL = 'Promotions/Travel';
export const LABEL_PROMOTIONS_TRAVEL_DISCOUNTS = 'Promotions/Travel/Discounts';
export const LABEL_PROMOTIONS_RETAIL = 'Promotions/Retail';
export const LABEL_PROMOTIONS_BEAUTY = 'Promotions/Beauty & Wellness';
export const LABEL_PROMOTIONS = 'Promotions';
export const LABEL_PROMOTIONS_FOOD = 'Promotions/Food & Drink';
/** Promotional health mail (practice marketing) — distinct from transactional Services & Alerts/Health */
export const LABEL_PROMOTIONS_HEALTH = 'Promotions/Health';
export const LABEL_PROMOTIONS_FINANCIAL = 'Promotions/Financial';
/** Streaming/media marketing (new arrivals, win-back offers) — the org side is Organization/OnlineBusiness */
export const LABEL_PROMOTIONS_ENTERTAINMENT = 'Promotions/Entertainment';
/** SaaS/developer-tool marketing (product tips, trial drips, webinars) — distinct from Product Updates, which is release news for tools in use */
export const LABEL_PROMOTIONS_TECH = 'Promotions/Tech';
/** Short-term rental operations — turnover scheduling, dynamic pricing, channel tooling. Host-side business mail, distinct from Travel (the user's own trips) and Real Estate (tenant inquiries) */
export const LABEL_SERVICES_RENTAL_OPS = 'Services & Alerts/Rental Ops';
/** USPS Informed Delivery daily digests — a scan of the day's mail, superseded by the next day's; archived and marked read on arrival */
export const LABEL_SERVICES_USPS = 'Services & Alerts/USPS';
export const LABEL_AUTOMOTIVE = 'Automotive';
export const LABEL_AUTOMOTIVE_SHOPPING = 'Automotive/Shopping';
export const LABEL_AUTOMOTIVE_INSURANCE = 'Automotive/Insurance';
export const LABEL_ADVOCACY = 'Advocacy';
export const LABEL_ADVOCACY_POLITICAL = 'Advocacy/Political';
export const LABEL_ADVOCACY_NONPROFIT = 'Advocacy/Non-Profit';
export const LABEL_ADVOCACY_CCV_BOARD = 'Advocacy/CCV Board';
export const LABEL_CAREER_OPPORTUNITY = 'Career/Opportunity';
export const LABEL_CAREER_FELLOWSHIP_INVITE = 'Career/Fellowship-Invite';
export const LABEL_PERSONAL_CORRESPONDENCE = 'Personal';
export const LABEL_PERSONAL_SELF_CORRESPONDENCE = 'Personal/Self';
export const LABEL_LEGAL = 'Legal';

/** Organization labels — schema.org Organization type hierarchy */
export const LABEL_ORG = 'Organization';
export const LABEL_ORG_OPEN_SOURCE = 'Organization/OpenSource';
export const LABEL_ORG_FINANCIAL = 'Organization/Financial';
export const LABEL_ORG_REAL_ESTATE = 'Organization/RealEstate';
export const LABEL_ORG_ECOMMERCE = 'Organization/Ecommerce';
export const LABEL_ORG_LOCAL_COMMUNITY = 'Organization/LocalCommunity';
export const LABEL_ORG_PROFESSIONAL = 'Organization/Professional';
export const LABEL_ORG_GOOGLE = 'Organization/Google';
export const LABEL_ORG_HEALTH = 'Organization/Health';
export const LABEL_ORG_TRAVEL = 'Organization/Travel';
export const LABEL_ORG_AUTOMOTIVE = 'Organization/Automotive';
/**
 * schema.org Corporation — absorbed the former BigTech and DeveloperTools groups,
 * neither of which was a schema.org type. TaxiService below is a Service subtype,
 * not an Organization one: it names the service the corporation provides.
 */
export const LABEL_ORG_CORPORATION = 'Organization/Corporation';
export const LABEL_ORG_CORP_TAXI_SERVICE = `${LABEL_ORG_CORPORATION}/TaxiService`;
/**
 * Ring is a wholly-owned Amazon subsidiary, so it nests under an Amazon instance
 * segment: Corporation (type) → Amazon (parent org) → Ring (subOrganization).
 * The Amazon segment carries no mail of its own — Amazon's own senders stay in
 * Organization/Ecommerce — it exists to record the parentOrganization link, the
 * same way Brazilian Zouk Council does for ZoukMX.
 */
export const LABEL_ORG_CORP_AMAZON_RING = `${LABEL_ORG_CORPORATION}/Amazon/Ring`;
/** Top-level OnlineBusiness — distinct from LocalCommunity/OnlineBusiness (local orgs) */
export const LABEL_ORG_ONLINE_BUSINESS = 'Organization/OnlineBusiness';
export const LABEL_ORG_ONLINE_STORE = `${LABEL_ORG_ONLINE_BUSINESS}/OnlineStore`;
export const LABEL_ORG_EDUCATIONAL = 'Organization/EducationalOrganization';
/**
 * schema.org has no DanceSchool type (404), so a dance academy is typed School under
 * EducationalOrganization. Nests under its parent org so the path records the
 * subOrganization link to the World Swing Dance Council, which sends no mail itself.
 * The academy is also a LocalBusiness — a multi-type, so it carries
 * LABEL_ORG_LC_LOCAL_BUSINESS as a second, independent tag.
 */
export const LABEL_ORG_EDU_WSDC_AWA =
  `${LABEL_ORG_EDUCATIONAL}/World Swing Dance Council/Austin Westie Academy`;
/**
 * schema.org SportsOrganization, at top level: "local vs. not" is not a schema
 * distinction, so every sports org lives here rather than under LocalCommunity.
 * ZoukMX nests under its parent org rather than directly under the type, so the
 * path records the subOrganization link; the council sends no mail of its own.
 */
export const LABEL_ORG_SPORTS = 'Organization/SportsOrganization';
/**
 * Top-level LocalBusiness subtree for national and online-only brands. Keeps the full
 * schema chain (Organization → LocalBusiness → Store → …) while staying out of
 * LocalCommunity/, which means "Austin-area org" and would misfile a national retailer.
 */
export const LABEL_ORG_LB = 'Organization/LocalBusiness';
export const LABEL_ORG_LB_STORE_CLOTHING = `${LABEL_ORG_LB}/Store/ClothingStore`;
export const LABEL_ORG_LB_STORE_GROCERY = `${LABEL_ORG_LB}/Store/GroceryStore`;
export const LABEL_ORG_LB_STORE_HOMEGOODS = `${LABEL_ORG_LB}/Store/HomeGoodsStore`;
export const LABEL_ORG_LB_FOOD = `${LABEL_ORG_LB}/FoodEstablishment`;
/**
 * Top-level PerformingGroup — orgs that stage performances for an audience. The
 * distinction from EntertainmentBusiness here is audience vs. participants: a touring
 * house presents shows people watch, while a social-dance producer runs events people
 * take part in.
 */
export const LABEL_ORG_PERFORMING_GROUP = 'Organization/PerformingGroup';
export const LABEL_ORG_SPORTS_ZOUKMX = `${LABEL_ORG_SPORTS}/Brazilian Zouk Dance Council/ZoukMX`;
export const LABEL_ORG_GOVERNMENT = 'Organization/Government';
/** National political parties and campaign committees — distinct from Government (public agencies) and LC/NGO (local nonprofits) */
export const LABEL_ORG_POLITICAL = `${LABEL_ORG}/Political`;
/**
 * Co-living / co-working operators. Named for the schema.org type they share;
 * "Digital Nomads" is their audience, carried as a DefinedTerm in the tag's
 * `schema.keywords` rather than as a path segment — an audience is not a type.
 */
export const LABEL_ORG_LODGING_BUSINESS = 'Organization/LodgingBusiness';
export const LABEL_ORG_PROFESSIONAL_METAPHYSICAL = 'Organization/Professional/Metaphysical-Esoteric-Alternative';
export const LABEL_ORG_PROFESSIONAL_HOME = 'Organization/Professional/Home';
export const LABEL_ORG_PROFESSIONAL_BEAUTY = 'Organization/Professional/Beauty';
export const LABEL_ORG_ECOMMERCE_FOOD = 'Organization/Ecommerce/Food & Delivery';
export const LABEL_ORG_ECOMMERCE_BEAUTY = 'Organization/Ecommerce/Beauty';
export const LABEL_ORG_ECOMMERCE_TECH = 'Organization/Ecommerce/Tech';

/**
 * LocalCommunity sub-sectors named for schema.org Organization subtypes, so an org's
 * type is recorded independently of where its mail routes. Sublabels are additive:
 * members keep the parent LocalCommunity tag as well.
 */
const ORG_LOCAL = LABEL_ORG_LOCAL_COMMUNITY;
export const LABEL_ORG_LC_COLLEGE = `${ORG_LOCAL}/CollegeOrUniversity`;
export const LABEL_ORG_LC_COLLEGE_ALUMNI = `${ORG_LOCAL}/CollegeOrUniversity/Texas Exes Alumni Association`;
export const LABEL_ORG_LC_GOVERNMENT = `${ORG_LOCAL}/GovernmentOrganization`;
export const LABEL_ORG_LC_NEWS_MEDIA = `${ORG_LOCAL}/NewsMediaOrganization`;
export const LABEL_ORG_LC_NGO = `${ORG_LOCAL}/NGO`;
export const LABEL_ORG_LC_CONSORTIUM = `${ORG_LOCAL}/Consortium`;
export const LABEL_ORG_LC_ONLINE_BUSINESS = `${ORG_LOCAL}/OnlineBusiness`;
/**
 * Bare LocalBusiness, for orgs whose only schema-expressible trait is an
 * areaServed narrow enough to be local. schema.org has no SocialOrganization type
 * (404), so social clubs land here rather than under a "social" segment.
 */
export const LABEL_ORG_LC_LOCAL_BUSINESS = `${ORG_LOCAL}/LocalBusiness`;
export const LABEL_ORG_LC_STORE = `${ORG_LOCAL}/LocalBusiness/Store`;
export const LABEL_ORG_LC_ENTERTAINMENT = `${ORG_LOCAL}/LocalBusiness/EntertainmentBusiness`;

export const LABEL_ORG_LC_PERFORMING_GROUP = `${ORG_LOCAL}/PerformingGroup`;
export const LABEL_ORG_LC_MUSEUM = `${ORG_LOCAL}/Museum`;
export const LABEL_ORG_LC_RESEARCH = `${ORG_LOCAL}/ResearchOrganization`;

/** Country labels — sender-origin tags, label-only (never route or archive) */
export const LABEL_COUNTRY = 'Country';
export const LABEL_COUNTRY_COLOMBIA = 'Country/Colombia';
export const LABEL_COUNTRY_MEXICO = 'Country/Mexico';

/** Default maximum results for Gmail list queries */
export const DEFAULT_MAX_RESULTS = 100;
/** Concurrent messages.get calls. Gmail rejects unbounded fan-out with "Too many concurrent requests for user". */
export const GMAIL_FETCH_CONCURRENCY = 25;
/** Gmail's hard cap on ids per messages.batchModify call. */
export const GMAIL_BATCH_MODIFY_LIMIT = 1000;

/** Milliseconds in one day */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const GMAIL_UNREAD = 'UNREAD';
export const GMAIL_SENT = 'SENT';
export const GMAIL_DRAFT = 'DRAFT';
export const GMAIL_SPAM = 'SPAM';
export const GMAIL_TRASH = 'TRASH';
export const GMAIL_IMPORTANT = 'IMPORTANT';
