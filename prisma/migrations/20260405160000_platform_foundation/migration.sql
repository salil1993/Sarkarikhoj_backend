-- Platform foundation: compliance settings, audit trail, categories, featured collections, editorial fields.

CREATE TABLE `scheme_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `label` VARCHAR(128) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `scheme_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `blog_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `label` VARCHAR(128) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `blog_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'SUPPORT',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_user_id` INTEGER NULL,
    `actor` VARCHAR(32) NOT NULL,
    `action` VARCHAR(128) NOT NULL,
    `resource` VARCHAR(64) NOT NULL,
    `resource_id` VARCHAR(64) NULL,
    `meta` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_resource_created_at_idx`(`resource`, `created_at`),
    INDEX `audit_logs_admin_user_id_created_at_idx`(`admin_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `site_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(128) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `site_settings_setting_key_key`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `featured_collections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(128) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `description` TEXT NULL,
    `kind` VARCHAR(24) NOT NULL,
    `config` JSON NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `featured_collections_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `featured_collection_items` (
    `collection_id` INTEGER NOT NULL,
    `scheme_id` INTEGER NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`collection_id`, `scheme_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `featured_collection_items` ADD CONSTRAINT `featured_collection_items_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `featured_collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `featured_collection_items` ADD CONSTRAINT `featured_collection_items_scheme_id_fkey` FOREIGN KEY (`scheme_id`) REFERENCES `schemes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `schemes` ADD COLUMN `publish_status` VARCHAR(32) NOT NULL DEFAULT 'published',
    ADD COLUMN `short_summary` TEXT NULL,
    ADD COLUMN `last_verified_at` DATETIME(3) NULL,
    ADD COLUMN `featured_image_url` VARCHAR(2048) NULL,
    ADD COLUMN `admin_notes` TEXT NULL,
    ADD COLUMN `compliance_notes` TEXT NULL,
    ADD COLUMN `category_id` INTEGER NULL;

CREATE INDEX `schemes_category_id_idx` ON `schemes`(`category_id`);

ALTER TABLE `schemes` ADD CONSTRAINT `schemes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `scheme_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `seo_blog_posts` ADD COLUMN `category_id` INTEGER NULL,
    ADD COLUMN `meta_title` VARCHAR(512) NULL,
    ADD COLUMN `meta_description` TEXT NULL,
    ADD COLUMN `og_image_url` VARCHAR(2048) NULL,
    ADD COLUMN `reading_time_minutes` INTEGER NULL,
    ADD COLUMN `author_name` VARCHAR(256) NULL,
    ADD COLUMN `canonical_url` VARCHAR(2048) NULL,
    ADD COLUMN `robots` VARCHAR(32) NULL DEFAULT 'index,follow';

CREATE INDEX `seo_blog_posts_category_id_idx` ON `seo_blog_posts`(`category_id`);

ALTER TABLE `seo_blog_posts` ADD CONSTRAINT `seo_blog_posts_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `blog_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `seo_pages` ADD COLUMN `meta_title` VARCHAR(512) NULL,
    ADD COLUMN `meta_description` TEXT NULL,
    ADD COLUMN `canonical_url` VARCHAR(2048) NULL,
    ADD COLUMN `robots` VARCHAR(32) NULL DEFAULT 'index,follow',
    ADD COLUMN `faq_json` JSON NULL,
    ADD COLUMN `structured_data_json` JSON NULL;
