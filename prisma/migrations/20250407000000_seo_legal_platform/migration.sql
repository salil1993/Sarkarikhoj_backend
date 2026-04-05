-- AlterTable: local targeting + optional JSON rules snapshot for SEO/API
ALTER TABLE `schemes`
    ADD COLUMN `district` VARCHAR(128) NULL,
    ADD COLUMN `category` VARCHAR(64) NULL,
    ADD COLUMN `eligibility_rules_json` JSON NULL;

CREATE INDEX `schemes_state_district_idx` ON `schemes` (`state`, `district`);
CREATE INDEX `schemes_category_idx` ON `schemes` (`category`);

-- Programmatic SEO / AI blog drafts
CREATE TABLE `seo_blog_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(255) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `excerpt` TEXT NULL,
    `body` TEXT NOT NULL,
    `faqs` JSON NULL,
    `focus_keyword` VARCHAR(128) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `seo_blog_posts_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
