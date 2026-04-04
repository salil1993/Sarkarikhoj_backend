-- CreateTable
CREATE TABLE `schemes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheme_name` VARCHAR(512) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `min_age` INTEGER NULL,
    `max_age` INTEGER NULL,
    `income_limit` INTEGER NULL,
    `gender` VARCHAR(32) NULL,
    `occupation` VARCHAR(128) NULL,
    `state` VARCHAR(128) NULL,
    `benefit` TEXT NOT NULL,
    `documents_required` TEXT NOT NULL,
    `apply_link` VARCHAR(2048) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `schemes_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
