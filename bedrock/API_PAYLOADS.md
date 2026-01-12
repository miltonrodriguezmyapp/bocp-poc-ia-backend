# Estructura de Payloads - API Bedrock

## 🔐 Autenticación

Todos los endpoints requieren el token JWT de Cognito en el header:

```http
Authorization: Bearer eyJraWQiOiJ...
Content-Type: application/json
```

---

## 📤 1. Cargar Archivo

**Endpoint:** `POST /bocppocia-bedrock/upload`

### Request Body

```json
{
  "fileBase64": "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKM...",
  "fileName": "contrato.pdf",
  "fileType": "application/pdf",
  "userId": "user-uuid-123",
  "sessionId": "session-uuid-456"
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `fileBase64` | string | ✅ Sí | Archivo en base64. Puede incluir el prefijo `data:{type};base64,` o solo el base64 |
| `fileName` | string | ✅ Sí | Nombre del archivo original (ej: "documento.pdf") |
| `fileType` | string | ❌ No | MIME type del archivo (ej: "application/pdf", "image/png") |
| `userId` | string | ✅ Sí | ID del usuario (obtener desde Cognito) |
| `sessionId` | string | ❌ No | ID de sesión para agrupar archivos. Si no se envía, se puede enviar null |

### Response Success (200)

```json
{
  "statusCode": 200,
  "result": true,
  "message": "Archivo subido correctamente.",
  "records": {
    "fileId": 123,
    "key": "bedrock-files/a1b2c3d4-e5f6-7890-abcd-ef1234567890_contrato.pdf",
    "url": "https://gs1apiedi-dev-files.s3.amazonaws.com/bedrock-files/a1b2c3d4-e5f6-7890-abcd-ef1234567890_contrato.pdf",
    "fileName": "a1b2c3d4-e5f6-7890-abcd-ef1234567890_contrato.pdf",
    "fileSize": 245678
  }
}
```

### Response Error (400)

```json
{
  "result": false,
  "message": "Faltan campos requeridos: fileBase64, fileName, userId"
}
```

### Ejemplo JavaScript

```javascript
// Convertir archivo a base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Llamada al endpoint
const uploadFile = async (file, userId, sessionId = null) => {
  const base64 = await fileToBase64(file);
  
  const response = await fetch('https://YOUR_API_URL/bocppocia-bedrock/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cognitoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileBase64: base64,
      fileName: file.name,
      fileType: file.type,
      userId: userId,
      sessionId: sessionId
    })
  });
  
  return await response.json();
};
```

---

## 💬 2. Enviar Prompt al Agente

**Endpoint:** `POST /bocppocia-bedrock/prompt`

### Request Body - Opción A: Con archivos específicos

```json
{
  "prompt": "Analiza el contrato y dame un resumen de las cláusulas principales",
  "userId": "user-uuid-123",
  "sessionId": "session-uuid-456",
  "fileIds": ["file-uuid-1", "file-uuid-2"],
  "agentId": "AGENT123ABC",
  "agentAliasId": "ALIAS456DEF"
}
```

### Request Body - Opción B: Sin archivos (busca automáticamente)

```json
{
  "prompt": "¿Qué documentos tengo disponibles?",
  "userId": "user-uuid-123",
  "sessionId": "session-uuid-456",
  "agentId": "AGENT123ABC",
  "agentAliasId": "ALIAS456DEF"
}
```

### Request Body - Opción C: Sin sesión (busca archivos globales del usuario)

```json
{
  "prompt": "Resume todos mis documentos recientes",
  "userId": "user-uuid-123",
  "agentId": "AGENT123ABC",
  "agentAliasId": "ALIAS456DEF"
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `prompt` | string | ✅ Sí | Pregunta o instrucción para el agente |
| `userId` | string | ✅ Sí | ID del usuario |
| `agentId` | string | ✅ Sí | ID del agente de Bedrock (proporcionado por AWS) |
| `agentAliasId` | string | ✅ Sí | ID del alias del agente (proporcionado por AWS) |
| `sessionId` | string | ❌ No | ID de sesión. Si no se envía, se genera uno nuevo |
| `fileIds` | array | ❌ No | Array de IDs de archivos específicos. Si no se envía, busca automáticamente |

### Response Success (200)

```json
{
  "statusCode": 200,
  "result": true,
  "message": "Prompt procesado exitosamente.",
  "records": {
    "conversationId": "conv-uuid-789",
    "sessionId": "session-uuid-456",
    "prompt": "Analiza el contrato y dame un resumen de las cláusulas principales",
    "response": "Basándome en el análisis del contrato, identifico las siguientes cláusulas principales:\n\n1. Objeto del contrato: Prestación de servicios de...\n2. Plazo de vigencia: 12 meses renovables...\n3. Condiciones de pago: Facturación mensual...\n\n[Respuesta completa del agente]",
    "files": [
      {
        "bedrockFileId": "file-uuid-1",
        "bedrockFileS3Key": "bedrock-files/contrato.pdf",
        "bedrockFileS3Url": "https://...",
        "bedrockFileName": "uuid_contrato.pdf",
        "bedrockFileType": "application/pdf"
      }
    ],
    "timestamp": "2025-12-14T10:30:00.000Z"
  }
}
```

### Response Error (500)

```json
{
  "statusCode": 500,
  "result": false,
  "message": "Error al procesar el prompt: Invalid agent ID",
  "error": "Error: ..."
}
```

### Ejemplo JavaScript

```javascript
// Opción A: Con archivos específicos
const sendPromptWithFiles = async (prompt, fileIds, sessionId, agentId, agentAliasId) => {
  const response = await fetch('https://YOUR_API_URL/bocppocia-bedrock/prompt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cognitoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      userId: currentUserId,
      sessionId: sessionId,
      fileIds: fileIds,
      agentId: agentId,
      agentAliasId: agentAliasId
    })
  });
  
  return await response.json();
};

// Opción B: Sin archivos (automático)
const sendPromptAutoFiles = async (prompt, sessionId, agentId, agentAliasId) => {
  const response = await fetch('https://YOUR_API_URL/bocppocia-bedrock/prompt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cognitoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      userId: currentUserId,
      sessionId: sessionId,
      agentId: agentId,
      agentAliasId: agentAliasId
      // NO se envía fileIds - el backend busca automáticamente
    })
  });
  
  return await response.json();
};
```

---

## 📁 3. Obtener Archivos del Usuario

**Endpoint:** `GET /bocppocia-bedrock/files`

### Query Parameters

```
GET /bocppocia-bedrock/files?userId=user-uuid-123&sessionId=session-uuid-456&limit=20&offset=0
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `userId` | string | ✅ Sí | ID del usuario |
| `sessionId` | string | ❌ No | Filtrar por sesión específica |
| `limit` | number | ❌ No | Cantidad de resultados (default: 20) |
| `offset` | number | ❌ No | Paginación offset (default: 0) |

### Response Success (200)

```json
{
  "statusCode": 200,
  "result": true,
  "message": "Archivos obtenidos exitosamente.",
  "records": [
    {
      "fileId": "file-uuid-1",
      "sessionId": "session-uuid-456",
      "fileName": "a1b2c3d4_contrato.pdf",
      "originalName": "contrato.pdf",
      "s3Key": "bedrock-files/a1b2c3d4_contrato.pdf",
      "s3Url": "https://gs1apiedi-dev-files.s3.amazonaws.com/bedrock-files/a1b2c3d4_contrato.pdf",
      "fileSize": 245678,
      "fileType": "application/pdf",
      "createdAt": "2025-12-14T10:30:00.000Z"
    },
    {
      "fileId": "file-uuid-2",
      "sessionId": "session-uuid-456",
      "fileName": "b2c3d4e5_factura.pdf",
      "originalName": "factura.pdf",
      "s3Key": "bedrock-files/b2c3d4e5_factura.pdf",
      "s3Url": "https://gs1apiedi-dev-files.s3.amazonaws.com/bedrock-files/b2c3d4e5_factura.pdf",
      "fileSize": 123456,
      "fileType": "application/pdf",
      "createdAt": "2025-12-14T10:25:00.000Z"
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

### Ejemplo JavaScript

```javascript
const getFiles = async (userId, sessionId = null, limit = 20, offset = 0) => {
  let url = `https://YOUR_API_URL/bocppocia-bedrock/files?userId=${userId}&limit=${limit}&offset=${offset}`;
  
  if (sessionId) {
    url += `&sessionId=${sessionId}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cognitoToken}`
    }
  });
  
  return await response.json();
};
```

---

## 📜 4. Obtener Historial de Conversaciones

**Endpoint:** `GET /bocppocia-bedrock/history`

### Query Parameters

```
GET /bocppocia-bedrock/history?sessionId=session-uuid-456&userId=user-uuid-123&limit=50&offset=0
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `sessionId` | string | ❌ No* | Filtrar por sesión específica |
| `userId` | string | ❌ No* | Filtrar por usuario |
| `limit` | number | ❌ No | Cantidad de resultados (default: 50) |
| `offset` | number | ❌ No | Paginación offset (default: 0) |

*Se requiere al menos uno: `sessionId` o `userId`

### Response Success (200)

```json
{
  "statusCode": 200,
  "result": true,
  "message": "Historial obtenido exitosamente.",
  "records": [
    {
      "conversationId": "conv-uuid-1",
      "sessionId": "session-uuid-456",
      "userId": "user-uuid-123",
      "prompt": "Analiza el contrato",
      "response": "Basándome en el análisis...",
      "agentId": "AGENT123ABC",
      "fileIds": ["file-uuid-1", "file-uuid-2"],
      "createdAt": "2025-12-14T10:30:00.000Z"
    },
    {
      "conversationId": "conv-uuid-2",
      "sessionId": "session-uuid-456",
      "userId": "user-uuid-123",
      "prompt": "¿Cuál es el plazo del contrato?",
      "response": "El plazo del contrato es de 12 meses...",
      "agentId": "AGENT123ABC",
      "fileIds": ["file-uuid-1"],
      "createdAt": "2025-12-14T10:32:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### Response Error (400)

```json
{
  "result": false,
  "message": "Se requiere al menos sessionId o userId"
}
```

### Ejemplo JavaScript

```javascript
const getHistory = async (sessionId = null, userId = null, limit = 50, offset = 0) => {
  if (!sessionId && !userId) {
    throw new Error('Se requiere sessionId o userId');
  }
  
  let url = `https://YOUR_API_URL/bocppocia-bedrock/history?limit=${limit}&offset=${offset}`;
  
  if (sessionId) url += `&sessionId=${sessionId}`;
  if (userId) url += `&userId=${userId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cognitoToken}`
    }
  });
  
  return await response.json();
};
```

---

## 🎯 Flujo Completo de Ejemplo

```javascript
// 1. Generar sesión única para la conversación
const sessionId = crypto.randomUUID(); // o usar una librería como uuid

// 2. Usuario carga un archivo
const file = document.getElementById('fileInput').files[0];
const uploadResult = await uploadFile(file, currentUserId, sessionId);
const fileId = uploadResult.records.fileId;

console.log('Archivo subido:', uploadResult);

// 3. Usuario envía un prompt sobre ese archivo
const promptResult = await sendPromptWithFiles(
  "Analiza este documento y dame un resumen",
  [fileId],
  sessionId,
  "AGENT123ABC",
  "ALIAS456DEF"
);

console.log('Respuesta del agente:', promptResult.records.response);

// 4. Usuario hace otra pregunta (sin especificar archivos)
// El backend usará automáticamente los archivos de la sesión
const followUpResult = await sendPromptAutoFiles(
  "¿Cuáles son los puntos clave?",
  sessionId,
  "AGENT123ABC",
  "ALIAS456DEF"
);

console.log('Seguimiento:', followUpResult.records.response);

// 5. Obtener historial de la conversación
const history = await getHistory(sessionId);
console.log('Historial completo:', history.records);

// 6. Listar todos los archivos del usuario
const allFiles = await getFiles(currentUserId);
console.log('Archivos disponibles:', allFiles.records);
```

---

## 🔑 Valores Requeridos de AWS

Los valores `agentId` y `agentAliasId` deben ser proporcionados por el equipo de infraestructura/DevOps:

```javascript
// Configuración del ambiente
const BEDROCK_CONFIG = {
  dev: {
    agentId: "XXXXXXXXXX",        // Obtener de AWS Console
    agentAliasId: "YYYYYYYYYY"    // Obtener de AWS Console
  },
  qa: {
    agentId: "XXXXXXXXXX",
    agentAliasId: "YYYYYYYYYY"
  },
  prod: {
    agentId: "XXXXXXXXXX",
    agentAliasId: "YYYYYYYYYY"
  }
};

// Uso
const config = BEDROCK_CONFIG[process.env.REACT_APP_ENV];
await sendPromptWithFiles(prompt, fileIds, sessionId, config.agentId, config.agentAliasId);
```

---

## ❌ Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| 400 | Faltan campos requeridos | Verificar que se envíen todos los campos obligatorios |
| 401 | No autorizado | Verificar que el token de Cognito sea válido |
| 500 | Error del servidor | Ver detalles en `error` field del response |
| 403 | Forbidden | Verificar permisos del usuario en Cognito |

---

## 📱 Ejemplo de Componente React

```jsx
import React, { useState } from 'react';

const BedrockChat = () => {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const result = await uploadFile(file, currentUserId, sessionId);
    
    if (result.result) {
      alert('Archivo cargado: ' + result.records.fileName);
    }
  };
  
  const handleSendPrompt = async () => {
    const result = await sendPromptAutoFiles(
      prompt,
      sessionId,
      "AGENT123ABC",
      "ALIAS456DEF"
    );
    
    if (result.result) {
      setMessages([...messages, {
        prompt: prompt,
        response: result.records.response
      }]);
      setPrompt('');
    }
  };
  
  return (
    <div>
      <input type="file" onChange={handleFileUpload} />
      <div>
        {messages.map((msg, idx) => (
          <div key={idx}>
            <p><strong>Usuario:</strong> {msg.prompt}</p>
            <p><strong>Agente:</strong> {msg.response}</p>
          </div>
        ))}
      </div>
      <input 
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Escribe tu pregunta..."
      />
      <button onClick={handleSendPrompt}>Enviar</button>
    </div>
  );
};
```
