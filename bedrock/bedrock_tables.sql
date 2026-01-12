-- Tabla para almacenar archivos subidos para Bedrock
CREATE TABLE IF NOT EXISTS `bedrock_files` (
  `bedrockFileId` VARCHAR(36) NOT NULL PRIMARY KEY,
  `bedrockFileUserId` VARCHAR(100) NOT NULL,
  `bedrockFileSessionId` VARCHAR(100) NULL,
  `bedrockFileName` VARCHAR(255) NOT NULL,
  `bedrockFileOriginalName` VARCHAR(255) NOT NULL,
  `bedrockFileS3Key` VARCHAR(500) NOT NULL,
  `bedrockFileS3Url` TEXT NOT NULL,
  `bedrockFileSize` BIGINT NOT NULL,
  `bedrockFileType` VARCHAR(100) NULL,
  `bedrockFileCreationDate` DATETIME NOT NULL,
  `bedrockFileDeleted` DATETIME NULL,
  INDEX `idx_user_id` (`bedrockFileUserId`),
  INDEX `idx_session_id` (`bedrockFileSessionId`),
  INDEX `idx_creation_date` (`bedrockFileCreationDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar conversaciones con el agente de Bedrock
CREATE TABLE IF NOT EXISTS `bedrock_conversations` (
  `bedrockConversationId` VARCHAR(36) NOT NULL PRIMARY KEY,
  `bedrockConversationSessionId` VARCHAR(100) NOT NULL,
  `bedrockConversationUserId` VARCHAR(100) NOT NULL,
  `bedrockConversationPrompt` TEXT NOT NULL,
  `bedrockConversationResponse` LONGTEXT NOT NULL,
  `bedrockConversationAgentId` VARCHAR(100) NOT NULL,
  `bedrockConversationFileIds` JSON NULL,
  `bedrockConversationCreationDate` DATETIME NOT NULL,
  `bedrockConversationDeleted` DATETIME NULL,
  INDEX `idx_session_id` (`bedrockConversationSessionId`),
  INDEX `idx_user_id` (`bedrockConversationUserId`),
  INDEX `idx_creation_date` (`bedrockConversationCreationDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentarios sobre las tablas
-- bedrock_files: Almacena metadata de los archivos subidos por los usuarios para usar con el agente
-- bedrock_conversations: Almacena el historial de conversaciones con el agente de Bedrock
