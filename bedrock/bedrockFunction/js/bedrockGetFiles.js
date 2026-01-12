const mysql2Connection = require('../../../config/db_' + process.env.stage);
const mysql = require('mysql2/promise');

module.exports.bedrockGetFiles = async (event) => {
  console.log('Event:', event);

  const params = event.queryStringParameters || {};
  const { userId, sessionId, limit = 20, offset = 0 } = params;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        result: false,
        message: "Se requiere userId"
      }),
    };
  }

  return await getFiles({
    userId,
    sessionId,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
};

async function getFiles(params) {
  const connection = await mysql.createConnection(mysql2Connection.options);

  try {
    let whereClause = `WHERE bedrockFileUserId = '${params.userId}' AND bedrockFileDeleted IS NULL`;
    
    if (params.sessionId) {
      whereClause += ` AND bedrockFileSessionId = '${params.sessionId}'`;
    }

    const query = `
      SELECT 
        bedrockFileId,
        bedrockFileSessionId,
        bedrockFileName,
        bedrockFileOriginalName,
        bedrockFileS3Key,
        bedrockFileS3Url,
        bedrockFileSize,
        bedrockFileType,
        bedrockFileCreationDate
      FROM bedrock_files
      ${whereClause}
      ORDER BY bedrockFileCreationDate DESC
      LIMIT ${params.limit}
      OFFSET ${params.offset}
    `;

    const [files] = await connection.query(query);

    // Contar total de archivos
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bedrock_files
      ${whereClause}
    `;
    
    const [countResult] = await connection.query(countQuery);
    const total = countResult[0].total;

    await connection.end();

    // Formatear los archivos
    const formattedFiles = files.map(file => ({
      fileId: file.bedrockFileId,
      sessionId: file.bedrockFileSessionId,
      fileName: file.bedrockFileName,
      originalName: file.bedrockFileOriginalName,
      s3Key: file.bedrockFileS3Key,
      s3Url: file.bedrockFileS3Url,
      fileSize: file.bedrockFileSize,
      fileType: file.bedrockFileType,
      createdAt: file.bedrockFileCreationDate
    }));

    const results = JSON.stringify({
      statusCode: 200,
      result: true,
      message: 'Archivos obtenidos exitosamente.',
      records: formattedFiles,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: (params.offset + params.limit) < total
      }
    });

    return results;
  } catch (err) {
    console.error('Error al obtener archivos:', err);
    await connection.end();
    
    return JSON.stringify({
      statusCode: 500,
      result: false,
      message: 'Error al obtener archivos: ' + err.message,
      error: err.toString()
    });
  }
}
