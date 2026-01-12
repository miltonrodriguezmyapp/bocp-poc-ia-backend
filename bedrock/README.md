# Integración con Amazon Bedrock Agent

Este módulo implementa la integración con un agente de Amazon Bedrock para permitir a los usuarios cargar archivos y realizar consultas mediante prompts.

## 📁 Estructura

```
bedrock/
├── bedrockFunction/
│   ├── js/
│   │   ├── bedrockUploadFile.js      # Carga de archivos a S3
│   │   ├── bedrockSendPrompt.js      # Envío de prompts al agente
│   │   └── bedrockGetHistory.js      # Obtención de historial
│   └── yml/
│       ├── bedrockUploadFile.yml     # Config endpoint upload
│       ├── bedrockSendPrompt.yml     # Config endpoint prompt
│       └── bedrockGetHistory.yml     # Config endpoint history
└── bedrock_tables.sql                # Script de creación de tablas
```

## 🔧 Configuración Requerida

### 1. Base de Datos
Ejecuta el script SQL para crear las tablas necesarias:
```sql
-- bedrock_files: Almacena metadata de archivos
-- bedrock_conversations: Almacena historial de conversaciones
```

### 2. Variables de Entorno
Las siguientes variables se configuran automáticamente:
- `BEDROCK_FILES_BUCKET`: Bucket S3 para archivos (gs1apiedi-{stage}-files)
- `AWS_REGION`: Región de AWS (us-east-1)
- `stage`: Ambiente (dev/qa/prod)

### 3. Agente de Bedrock
Debes tener un agente de Bedrock ya creado. Necesitarás:
- **agentId**: ID del agente
- **agentAliasId**: ID del alias del agente

## 📡 Endpoints API

### 1. Cargar Archivo
**POST** `/bocppocia-bedrock/upload`

**Body:**
```json
{
  "fileBase64": "data:image/png;base64,iVBORw0KGgo...",
  "fileName": "documento.pdf",
  "fileType": "application/pdf",
  "userId": "user123",
  "sessionId": "session-uuid-optional"
}
```

**Respuesta:**
```json
{
  "statusCode": 200,
  "result": true,
  "message": "Archivo subido correctamente.",
  "records": {
    "fileId": 123,
    "key": "bedrock-files/uuid_documento.pdf",
    "url": "https://s3.amazonaws.com/...",
    "fileName": "uuid_documento.pdf",
    "fileSize": 245678
  }
}
```
**POST** `/bocppocia-bedrock/prompt`

**Comportamiento Inteligente de Archivos:**
- ✅ **Con fileIds**: Usa los archivos específicos proporcionados
- ✅ **Sin fileIds + con sessionId**: Busca automáticamente archivos de la sesión actual (últimos 10)
- ✅ **Sin fileIds + sin sessionId**: Busca los archivos más recientes del usuario (últimos 10)

**Body:**
```json
{
  "prompt": "Analiza el documento y dame un resumen",
  "userId": "user123",
  "sessionId": "session-uuid",
  "fileIds": ["file-uuid-1", "file-uuid-2"],  // OPCIONAL
  "agentId": "AGENT123ABC",
  "agentAliasId": "ALIAS456DEF"
}
```

**Ejemplo sin archivos específicos** (usa archivos recientes automáticamente):
```json
{
  "prompt": "¿Qué información tienes de los documentos cargados?",
  "userId": "user123",
  "sessionId": "session-uuid",
  "agentId": "AGENT123ABC",
  "agentAliasId": "ALIAS456DEF"
}
```

**Respuesta:**
```json
{
  "statusCode": 200,
  "result": true,
  "message": "Prompt procesado exitosamente.",
  "records": {
    "conversationId": "conv-uuid",
    "sessionId": "session-uuid",
    "prompt": "Analiza el documento...",
    "response": "Aquí está el análisis...",
    "files": [...],
    "timestamp": "2025-12-14T10:30:00Z"
  }
}
```

### 3. Obtener Archivos del Usuario
**GET** `/bocppocia-bedrock/files?userId=xxx&sessionId=xxx&limit=20&offset=0`

**Query Parameters:**
- `userId` (requerido): ID del usuario
- `sessionId` (opcional): ID de sesión específica
- `limit` (opcional): Número de resultados (default: 20)
- `offset` (opcional): Desplazamiento para paginación (default: 0)

**Respuesta:**
```json
{
  "statusCode": 200,
  "result": true,
  "message": "Archivos obtenidos exitosamente.",
  "records": [
    {
      "fileId": "file-uuid-1",
      "sessionId": "session-uuid",
      "fileName": "uuid_documento.pdf",
      "originalName": "documento.pdf",
      "s3Key": "bedrock-files/uuid_documento.pdf",
      "s3Url": "https://s3.amazonaws.com/...",
      "fileSize": 245678,
      "fileType": "application/pdf",
      "createdAt": "2025-12-14T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### 4. Obtener Historial de Conversaciones
**GET** `/bocppocia-bedrock/history?sessionId=xxx&userId=xxx&limit=50&offset=0`

**Query Parameters:**
- `sessionId` (opcional): ID de sesión específica
- `userId` (opcional): ID del usuario
- `limit` (opcional): Número de resultados (default: 50)
- `offset` (opcional): Desplazamiento para paginación (default: 0)

**Respuesta:**
```json
{
  "statusCode": 200,
  "result": true,
  "message": "Historial obtenido exitosamente.",
### Flujo Completo con Manejo Inteligente de Archivos

```javascript
// 1. Cargar archivo (opcional)
const uploadFile = async (file, userId, sessionId) => {
  const base64 = await fileToBase64(file);
  const response = await fetch('/bocppocia-bedrock/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileBase64: base64,
      fileName: file.name,
      fileType: file.type,
      userId: userId,
      sessionId: sessionId  // Asociar archivo a la sesión
    })
  });
  return response.json();
};

// 2. Obtener archivos disponibles del usuario
const getAvailableFiles = async (userId, sessionId = null) => {
  let url = `/bocppocia-bedrock/files?userId=${userId}`;
  if (sessionId) {
    url += `&sessionId=${sessionId}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// 3A. Enviar prompt CON archivos específicos
const sendPromptWithFiles = async (prompt, fileIds, sessionId) => {
  const response = await fetch('/bocppocia-bedrock/prompt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      userId: currentUserId,
      sessionId: sessionId,
      fileIds: fileIds,  // Archivos específicos
      agentId: 'YOUR_AGENT_ID',
      agentAliasId: 'YOUR_ALIAS_ID'
    })
  });
  return response.json();
};

// 3B. Enviar prompt SIN archivos (usa archivos recientes automáticamente)
const sendPromptAutoFiles = async (prompt, sessionId) => {
  const response = await fetch('/bocppocia-bedrock/prompt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      userId: currentUserId,
      sessionId: sessionId,
      // NO se envían fileIds - el backend buscará automáticamente
      agentId: 'YOUR_AGENT_ID',
      agentAliasId: 'YOUR_ALIAS_ID'
    })
  });
  return response.json();
};

// 4. Obtener historial
const getHistory = async (sessionId) => {
  const response = await fetch(
    `/bocppocia-bedrock/history?sessionId=${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};

// Ejemplo de uso completo
const chatWithBedrock = async () => {
  const sessionId = generateUUID();
  
  // Opción 1: Usuario carga archivos nuevos
  if (userHasNewFiles) {
    const fileResponse = await uploadFile(newFile, userId, sessionId);
    const fileId = fileResponse.records.fileId;
    
    // Consultar sobre ese archivo específico
    await sendPromptWithFiles(
      "Analiza este documento",
      [fileId],
      sessionId
    );
  }
  
  // Opción 2: Usuario pregunta sin cargar archivos nuevos
  else {
    // El backend buscará automáticamente archivos recientes
    await sendPromptAutoFiles(
      "¿Qué información tienes disponible?",
      sessionId
    );
  }
  
  // Mostrar historial
  const history = await getHistory(sessionId);
};
```

### Casos de Uso

**Caso 1: Usuario carga un archivo y consulta sobre él**
```javascript
// 1. Cargar archivo
const uploadResult = await uploadFile(pdfFile, userId, sessionId);
// 2. Consultar específicamente sobre ese archivo
await sendPromptWithFiles("Resume este documento", [uploadResult.records.fileId], sessionId);
```

**Caso 2: Usuario pregunta sin cargar archivos (usa archivos previos)**
```javascript
// El usuario ya cargó archivos antes en esta sesión o en sesiones anteriores
// No necesita especificar fileIds - el backend los busca automáticamente
await sendPromptAutoFiles("¿Qué documentos tengo cargados?", sessionId);
```

**Caso 3: Listar archivos y seleccionar cuáles usar**
```javascript
// 1. Obtener archivos disponibles
const filesResult = await getAvailableFiles(userId, sessionId);
const availableFiles = filesResult.records;

// 2. Usuario selecciona archivos desde la UI
const selectedFileIds = userSelectedFiles.map(f => f.fileId);

// 3. Consultar sobre archivos seleccionados
await sendPromptWithFiles("Compara estos documentos", selectedFileIds, sessionId)     userId: userId
    })
  });
  return response.json();
};

// 2. Enviar prompt
const sendPrompt = async (prompt, fileIds, sessionId) => {
  const response = await fetch('/bocppocia-bedrock/prompt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      userId: currentUserId,
      sessionId: sessionId,
      fileIds: fileIds,
      agentId: 'YOUR_AGENT_ID',
      agentAliasId: 'YOUR_ALIAS_ID'
    })
  });
  return response.json();
};

// 3. Obtener historial
const getHistory = async (sessionId) => {
  const response = await fetch(
    `/bocppocia-bedrock/history?sessionId=${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

## 📝 Notas

### Comportamiento Inteligente de Archivos

La implementación maneja automáticamente tres escenarios:

1. **Archivos Específicos Proporcionados** (`fileIds` en request)
   - Usa exactamente los archivos indicados
   - Útil cuando el usuario selecciona documentos específicos de una lista

2. **Sin Archivos + Con SessionId**
   - Busca automáticamente los últimos 10 archivos de la sesión actual
   - Perfecto para conversaciones continuas sobre documentos de una sesión

3. **Sin Archivos + Sin SessionId**
   - Busca los últimos 10 archivos del usuario (global)
   - Útil para consultas generales sobre documentos recientes

### Detalles Técnicos

- Los archivos se guardan en `bedrock-files/` dentro del bucket S3
- Cada archivo recibe un nombre único con UUID para evitar colisiones
- Las conversaciones se almacenan en la BD para auditoría y análisis
- El sessionId permite mantener contexto entre múltiples prompts
- Límite de 10 archivos automáticos para optimizar el contexto del agente
- Los archivos se ordenan por fecha de creación (más recientes primero)

### Gestión de Archivos

- **Upload**: Los archivos se asocian opcionalmente a una sesión
- **Auto-discovery**: El sistema busca archivos relevantes si no se especifican
- **Soft Delete**: Los archivos marcados como eliminados no se usan automáticamente
- **Paginación**: Disponible en endpoints de listado para grandes volúmenes
