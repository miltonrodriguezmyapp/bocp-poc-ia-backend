const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const mysql2Connection = require('../../../config/db_' + process.env.stage);
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

module.exports.bedrockUploadFile = async (event) => {
  console.log('Event:', event);

  let body;
  if (typeof event.body === 'string') {
    body = JSON.parse(event.body);
  } else {
    body = event.body;
  }

  const { fileBase64, fileName, fileType, userId, sessionId } = body;

  if (!fileBase64 || !fileName || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        result: false,
        message: "Faltan campos requeridos: fileBase64, fileName, userId" 
      }),
    };
  }

  // Remover el prefijo de base64 si existe
  let cleanBase64 = fileBase64;
  if (fileBase64.includes('base64,')) {
    cleanBase64 = fileBase64.split('base64,')[1];
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${uuidv4()}_${fileName}`;
  const s3Key = `bedrock-files/${uniqueFileName}`;

  const params = {
    Bucket: process.env.BEDROCK_FILES_BUCKET || 'gs1apiedi-qa-files',
    Key: s3Key,
    Body: buffer,
    ContentType: fileType || 'application/octet-stream',
  };

  return await transaction(params, {
    userId,
    fileName,
    originalFileName: fileName,
    s3Key,
    fileSize: buffer.length,
    fileType,
    sessionId: sessionId || null
  });
};

async function transaction(s3Params, fileMetadata) {
  const connection = await mysql.createConnection(mysql2Connection.options);
  
  try {
    await connection.beginTransaction();

    // Subir archivo a S3
    const s3Result = await s3.upload(s3Params).promise();
    console.log('Archivo subido a S3:', s3Result);

    // Guardar metadata en base de datos
    const insertQuery = `
      INSERT INTO bedrock_files (
        bedrockFileId,
        bedrockFileUserId,
        bedrockFileSessionId,
        bedrockFileName,
        bedrockFileOriginalName,
        bedrockFileS3Key,
        bedrockFileS3Url,
        bedrockFileSize,
        bedrockFileType,
        bedrockFileCreationDate
      ) VALUES (
        UUID(),
        '${fileMetadata.userId}',
        ${fileMetadata.sessionId ? `'${fileMetadata.sessionId}'` : 'NULL'},
        '${fileMetadata.fileName}',
        '${fileMetadata.originalFileName}',
        '${fileMetadata.s3Key}',
        '${s3Result.Location}',
        ${fileMetadata.fileSize},
        ${fileMetadata.fileType ? `'${fileMetadata.fileType}'` : 'NULL'},
        NOW()
      )
    `;

    const queryResult = await connection.query(insertQuery);
    
    await connection.commit();
    await connection.end();

    const results = JSON.stringify({
      statusCode: 200,
      result: true,
      message: 'Archivo subido correctamente.',
      records: {
        fileId: queryResult[0].insertId,
        key: s3Result.Key,
        url: s3Result.Location,
        fileName: fileMetadata.fileName,
        fileSize: fileMetadata.fileSize
      },
    });

    return results;
  } catch (err) {
    console.error('Error en transaction:', err);
    await connection.rollback();
    await connection.end();
    return Promise.reject(err);
  }
}
