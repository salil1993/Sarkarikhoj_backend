CREATE TABLE `seo_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(32) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `description` TEXT NULL,
    `payload` JSON NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `seo_pages_slug_key`(`slug`),
    INDEX `seo_pages_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
