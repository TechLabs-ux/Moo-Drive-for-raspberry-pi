const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const os = require('os');
const bodyParser = require('body-parser'); // Adicionado para compatibilidade

const app = express();
const PORT = 3000;

// Configurações
const UPLOAD_FOLDER = './files';
if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER);
}

// Configuração do Multer para upload (versão 1.4.4)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_FOLDER);
    },
    filename: (req, file, cb) => {
        // Adiciona timestamp ao nome do arquivo para evitar sobrescrita
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

// Middlewares (usando body-parser para compatibilidade)
app.use(cors());
app.use(bodyParser.json()); // Substitui express.json() para Node 12
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(path.join(__dirname, 'files')));

// Rota principal - redireciona para o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas da API
app.get('/api/files', (req, res) => {
    fs.readdir(UPLOAD_FOLDER, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao ler a pasta' });
        }

        // Filtra apenas arquivos (ignora diretórios)
        const filteredFiles = files.filter(file => {
            return !fs.statSync(path.join(UPLOAD_FOLDER, file)).isDirectory();
        });

        const fileData = filteredFiles.map(file => {
            const filePath = path.join(UPLOAD_FOLDER, file);
            const stats = fs.statSync(filePath);
            
            return {
                name: file,
                path: `/files/${file}`,
                size: stats.size,
                modified: stats.mtime,
                type: path.extname(file).substring(1).toLowerCase() || 'file',
                isDirectory: false
            };
        });

        res.json(fileData);
    });
});

// Upload de arquivo único
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    res.json({ 
        message: 'Arquivo enviado com sucesso', 
        file: {
            originalname: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: `/files/${req.file.filename}`
        }
    });
});

// Download de arquivo
app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(UPLOAD_FOLDER, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        // Verifica se é um arquivo (não diretório)
        if (fs.statSync(filePath).isDirectory()) {
            return res.status(400).json({ error: 'O caminho especificado é um diretório' });
        }
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'Arquivo não encontrado' });
    }
});

// Exclusão de arquivo (nova rota adicionada)
app.delete('/api/delete/:filename', (req, res) => {
    const filePath = path.join(UPLOAD_FOLDER, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        if (fs.statSync(filePath).isDirectory()) {
            return res.status(400).json({ error: 'Não é permitido excluir diretórios' });
        }
        
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao excluir arquivo' });
            }
            res.json({ message: 'Arquivo excluído com sucesso' });
        });
    } else {
        res.status(404).json({ error: 'Arquivo não encontrado' });
    }
});

// Obter endereços de rede (compatível com Node 12)
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            // Node 12 usa 'IPv4' (em versões mais novas é '4')
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    
    return addresses;
}

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    const networkAddresses = getNetworkInterfaces();
    
    console.log(`Servidor rodando em:`);
    console.log(`- Local: http://localhost:${PORT}`);
    
    networkAddresses.forEach(ip => {
        console.log(`- Rede: http://${ip}:${PORT}`);
    });
});

// Tratamento de erros
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Porta ${PORT} já está em uso.`);
    } else {
        console.error('Erro ao iniciar o servidor:', error);
    }
    process.exit(1);
});