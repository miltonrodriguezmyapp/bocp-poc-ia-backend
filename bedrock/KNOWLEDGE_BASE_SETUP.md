# Configuración de Knowledge Base para Productos en S3

## 📋 Arquitectura de la Solución

El usuario puede consultar información de productos mediante prompts, y el agente de Bedrock buscará automáticamente en S3 usando un Knowledge Base.

---

## 🗂️ 1. Estructura Recomendada en S3

### Opción A: Organización por Código de Producto

```
s3://gs1apiedi-dev-files/knowledge-base/productos/
├── PROD-001/
│   ├── ficha-tecnica.pdf
│   ├── especificaciones.json
│   ├── manual-usuario.pdf
│   └── metadata.json
├── PROD-002/
│   ├── ficha-tecnica.pdf
│   ├── especificaciones.json
│   └── catalogo.pdf
└── PROD-003/
    └── informacion-completa.pdf
```

### Opción B: Con Metadatos en el Nombre del Archivo

```
s3://gs1apiedi-dev-files/knowledge-base/productos/
├── [PROD-001]_ficha-tecnica.pdf
├── [PROD-001]_especificaciones.json
├── [PROD-002]_manual-usuario.pdf
└── [PROD-003]_catalogo.pdf
```

### Archivo de Metadata (metadata.json)

```json
{
  "productCode": "PROD-001",
  "productName": "Producto XYZ",
  "category": "Electrónica",
  "brand": "Marca ABC",
  "lastUpdated": "2025-12-14",
  "documents": [
    "ficha-tecnica.pdf",
    "especificaciones.json",
    "manual-usuario.pdf"
  ]
}
```

---

## ⚙️ 2. Configuración del Knowledge Base en AWS

### 2.1. Crear el Knowledge Base

**Via AWS Console:**

1. Ir a **Amazon Bedrock Console** > **Knowledge bases**
2. Click en **Create knowledge base**
3. Configurar:

```yaml
Nombre: gs1-productos-knowledge-base
Descripción: Base de conocimiento de información de productos

Data Source:
  Type: Amazon S3
  S3 URI: s3://gs1apiedi-dev-files/knowledge-base/productos/
  
Chunking Strategy: Default chunking
Embedding Model: amazon.titan-embed-text-v1
Vector Store: Amazon OpenSearch Serverless (o Pinecone/Redis)
```

### 2.2. Configuración del Data Source

```json
{
  "dataSourceConfiguration": {
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "arn:aws:s3:::gs1apiedi-dev-files",
      "inclusionPrefixes": [
        "knowledge-base/productos/"
      ]
    }
  },
  "vectorIngestionConfiguration": {
    "chunkingConfiguration": {
      "chunkingStrategy": "FIXED_SIZE",
      "fixedSizeChunkingConfiguration": {
        "maxTokens": 300,
        "overlapPercentage": 20
      }
    }
  }
}
```

### 2.3. Configurar el Agente para Usar el Knowledge Base

```json
{
  "agentName": "gs1-products-agent",
  "agentResourceRoleArn": "arn:aws:iam::ACCOUNT:role/BedrockAgentRole",
  "foundationModel": "anthropic.claude-v2",
  "knowledgeBases": [
    {
      "knowledgeBaseId": "KB123456",
      "description": "Información de productos almacenada en S3",
      "knowledgeBaseState": "ENABLED"
    }
  ]
}
```

---

## 🔧 3. Actualización del Backend

### 3.1. Agregar Configuración del Knowledge Base

Crear archivo de configuración:

**`bedrock/config/knowledgeBase.js`**

```javascript
module.exports = {
  dev: {
    knowledgeBaseId: 'KB_DEV_123456',
    dataSourceId: 'DS_DEV_789012'
  },
  qa: {
    knowledgeBaseId: 'KB_QA_123456',
    dataSourceId: 'DS_QA_789012'
  },
  prod: {
    knowledgeBaseId: 'KB_PROD_123456',
    dataSourceId: 'DS_PROD_789012'
  }
};
```

### 3.2. Función para Subir Documentos de Productos

**`bedrock/bedrockFunction/js/bedrockUploadProductDocument.js`**

```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const bedrock = new AWS.BedrockAgent();
const { v4: uuidv4 } = require('uuid');

module.exports.bedrockUploadProductDocument = async (event) => {
  let body = JSON.parse(event.body);
  
  const { 
    fileBase64, 
    fileName, 
    productCode,      // Código del producto
    documentType,     // Tipo: 'ficha-tecnica', 'manual', 'especificaciones'
    userId 
  } = body;

  // Limpiar base64
  const cleanBase64 = fileBase64.includes('base64,') 
    ? fileBase64.split('base64,')[1] 
    : fileBase64;
  
  const buffer = Buffer.from(cleanBase64, 'base64');
  const uniqueFileName = `${uuidv4()}_${fileName}`;
  
  // Estructura de ruta por producto
  const s3Key = `knowledge-base/productos/${productCode}/${documentType}_${uniqueFileName}`;

  // Metadatos del documento
  const metadata = {
    productCode: productCode,
    documentType: documentType,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString()
  };

  const params = {
    Bucket: process.env.BEDROCK_FILES_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'application/pdf',
    Metadata: metadata
  };

  try {
    // Subir a S3
    const s3Result = await s3.upload(params).promise();
    
    // Sincronizar con Knowledge Base
    const kbConfig = require('../config/knowledgeBase')[process.env.stage];
    
    await bedrock.startIngestionJob({
      knowledgeBaseId: kbConfig.knowledgeBaseId,
      dataSourceId: kbConfig.dataSourceId
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: true,
        message: 'Documento de producto subido y sincronizado con Knowledge Base',
        records: {
          s3Key: s3Result.Key,
          s3Url: s3Result.Location,
          productCode: productCode,
          documentType: documentType
        }
      })
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        result: false,
        message: 'Error al subir documento: ' + err.message
      })
    };
  }
};
```

### 3.3. Actualizar bedrockSendPrompt para Usar Knowledge Base

La consulta se hace automáticamente si el agente está configurado con el Knowledge Base. No necesitas cambios adicionales en `bedrockSendPrompt.js`, pero puedes mejorar el prompt:

```javascript
// En bedrockSendPrompt.js - mejorar el prompt
let enhancedPrompt = params.prompt;

// Si se especifican códigos de producto, mejorar el prompt
if (params.productCodes && params.productCodes.length > 0) {
  const productList = params.productCodes.join(', ');
  enhancedPrompt = `${params.prompt}\n\nProductos a consultar: ${productList}`;
}
```

---

## 📡 4. Nuevos Endpoints API

### 4.1. Subir Documento de Producto

**POST** `/bocppocia-bedrock/product-document/upload`

```json
{
  "fileBase64": "data:application/pdf;base64,JVBERi0x...",
  "fileName": "ficha-tecnica.pdf",
  "productCode": "PROD-001",
  "documentType": "ficha-tecnica",
  "userId": "user123"
}
```

### 4.2. Consultar Información de Productos

**POST** `/bocppocia-bedrock/prompt`

**Opción A: Consulta de un solo producto**

```json
{
  "prompt": "¿Cuáles son las especificaciones técnicas del producto PROD-001?",
  "userId": "user123",
  "sessionId": "session-uuid",
  "agentId": "AGENT123",
  "agentAliasId": "ALIAS456"
}
```

**Opción B: Consulta de múltiples productos**

```json
{
  "prompt": "Compara las características de los productos PROD-001 y PROD-002",
  "userId": "user123",
  "sessionId": "session-uuid",
  "productCodes": ["PROD-001", "PROD-002"],
  "agentId": "AGENT123",
  "agentAliasId": "ALIAS456"
}
```

**Opción C: Consulta por categoría**

```json
{
  "prompt": "Muéstrame todos los productos de la categoría Electrónica",
  "userId": "user123",
  "sessionId": "session-uuid",
  "agentId": "AGENT123",
  "agentAliasId": "ALIAS456"
}
```

---

## 🎯 5. Ejemplos de Prompts para Usuarios

### Consultas Simples

```
"Dame información del producto PROD-001"
"¿Qué precio tiene el producto PROD-002?"
"Muéstrame las especificaciones técnicas de PROD-001"
```

### Consultas Comparativas

```
"Compara PROD-001 con PROD-002"
"¿Cuál es la diferencia entre PROD-001 y PROD-003?"
"¿Qué producto es mejor para uso industrial: PROD-001 o PROD-002?"
```

### Consultas por Atributos

```
"Muéstrame productos con garantía mayor a 2 años"
"¿Qué productos tienen certificación ISO?"
"Lista productos de la marca ABC"
```

---

## 🔐 6. Permisos IAM Necesarios

Actualizar el archivo `resources/iam/bedrockAgentRole.yml`:

```yaml
bedrockAgentRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: ${self:app}-${self:provider.stage}-bedrock-agent-role
    AssumeRolePolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal:
            Service:
              - bedrock.amazonaws.com
          Action: sts:AssumeRole
    Policies:
      - PolicyName: BedrockKnowledgeBasePolicy
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            # Permisos para Knowledge Base
            - Effect: Allow
              Action:
                - bedrock:Retrieve
                - bedrock:RetrieveAndGenerate
                - bedrock:InvokeAgent
              Resource: "*"
            
            # Permisos para S3 (leer documentos)
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:ListBucket
              Resource:
                - arn:aws:s3:::gs1apiedi-${self:provider.stage}-files/*
                - arn:aws:s3:::gs1apiedi-${self:provider.stage}-files
            
            # Permisos para OpenSearch (vector store)
            - Effect: Allow
              Action:
                - aoss:APIAccessAll
              Resource: "*"
```

---

## 📊 7. Respuesta del Agente con Knowledge Base

Cuando el agente usa el Knowledge Base, la respuesta incluye las fuentes:

```json
{
  "statusCode": 200,
  "result": true,
  "message": "Prompt procesado exitosamente.",
  "records": {
    "conversationId": "conv-uuid",
    "sessionId": "session-uuid",
    "prompt": "¿Cuáles son las especificaciones de PROD-001?",
    "response": "El producto PROD-001 tiene las siguientes especificaciones:\n- Dimensiones: 10x20x30 cm\n- Peso: 2.5 kg\n- Garantía: 3 años\n- Certificación: ISO 9001",
    "sources": [
      {
        "location": {
          "s3Location": {
            "uri": "s3://gs1apiedi-dev-files/knowledge-base/productos/PROD-001/ficha-tecnica.pdf"
          }
        },
        "generatedResponsePart": {
          "textResponsePart": {
            "text": "Dimensiones: 10x20x30 cm...",
            "span": {
              "start": 0,
              "end": 50
            }
          }
        }
      }
    ],
    "timestamp": "2025-12-14T10:30:00.000Z"
  }
}
```

---

## 🚀 8. Pasos de Implementación

### Paso 1: Configurar S3
```bash
# Crear estructura de carpetas
aws s3 mb s3://gs1apiedi-dev-files/knowledge-base/productos/
```

### Paso 2: Crear Knowledge Base en AWS Console
1. Amazon Bedrock > Knowledge bases > Create
2. Configurar S3 como data source
3. Seleccionar embedding model
4. Configurar vector store

### Paso 3: Asociar Knowledge Base al Agente
```bash
aws bedrock-agent update-agent \
  --agent-id AGENT_ID \
  --knowledge-bases knowledgeBaseId=KB_ID,description="Productos"
```

### Paso 4: Subir Documentos Iniciales
```bash
# Subir documentos de productos
aws s3 sync ./productos-data/ s3://gs1apiedi-dev-files/knowledge-base/productos/
```

### Paso 5: Iniciar Ingestion Job
```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id KB_ID \
  --data-source-id DS_ID
```

### Paso 6: Probar con un Prompt
```bash
curl -X POST https://API_URL/bocppocia-bedrock/prompt \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Dame info del producto PROD-001",
    "userId": "user123",
    "agentId": "AGENT_ID",
    "agentAliasId": "ALIAS_ID"
  }'
```

---

## 💡 9. Mejores Prácticas

### Organización de Documentos
✅ Un directorio por producto
✅ Nombres de archivo descriptivos
✅ Incluir metadata.json por producto
✅ Mantener versiones históricas

### Metadatos Útiles
```json
{
  "productCode": "PROD-001",
  "productName": "Widget Pro",
  "category": "Hardware",
  "brand": "TechCorp",
  "version": "2.0",
  "lastUpdated": "2025-12-14",
  "tags": ["industrial", "certificado", "premium"]
}
```

### Sincronización
- Ejecutar ingestion job después de subir nuevos documentos
- Programar sincronización periódica (diaria/semanal)
- Monitorear el estado del Knowledge Base

---

## ⚠️ Consideraciones Importantes

1. **Costo**: El Knowledge Base tiene costo por almacenamiento de vectores y consultas
2. **Latencia**: La primera consulta puede tardar más mientras indexa
3. **Límites**: Revisar límites de tamaño de documentos (generalmente 50MB por archivo)
4. **Formato**: PDF, TXT, MD, HTML son soportados nativamente
5. **Actualización**: Los cambios en S3 requieren re-indexación

---

## 📝 Resumen

Para que el usuario consulte productos por código:

1. ✅ Organiza documentos en S3 por código de producto
2. ✅ Crea un Knowledge Base de Bedrock apuntando a S3
3. ✅ Asocia el Knowledge Base a tu agente
4. ✅ El usuario envía prompts mencionando códigos de producto
5. ✅ El agente busca automáticamente en el Knowledge Base
6. ✅ Retorna información con fuentes citadas

**No necesitas modificar mucho el código actual** - el agente de Bedrock maneja la búsqueda automáticamente si está bien configurado.
