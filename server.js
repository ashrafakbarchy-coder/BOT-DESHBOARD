
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Security: Simple Basic Auth Authentication (Private Access) ---
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'nurox123'; // তোমার নিজের সিক্রেট পাসওয়ার্ড দাও

app.use((req, res, next) => {
  const auth = { login: ADMIN_USER, password: ADMIN_PASS };
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('🔒 Unauthorized: Access Denied. Private Dashboard!');
});

// Environment Variables for GitHub Integration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHub Personal Access Token
const REPO_OWNER = process.env.REPO_OWNER || 'your-github-username'; // GitHub Username
const REPO_NAME = process.env.REPO_NAME || 'nuke-bot'; // Bot repo name
const FILE_PATH = process.env.FILE_PATH || 'index.js'; // Bot main code file

// Frontend Dashboard HTML UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MAXO Private Control Panel</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #0f172a; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background: #1e293b; padding: 35px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 480px; border: 1px solid #334155; }
        h2 { color: #38bdf8; text-align: center; font-size: 24px; margin-bottom: 20px; letter-spacing: 0.5px; }
        label { display: block; margin-top: 15px; font-weight: 600; font-size: 14px; color: #94a3b8; }
        input, textarea { width: 100%; padding: 12px; margin-top: 6px; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; transition: 0.3s; }
        input:focus, textarea:focus { border-color: #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.3); }
        button { width: 100%; margin-top: 25px; background: #0284c7; color: white; border: none; padding: 14px; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; }
        button:hover { background: #0369a1; }
        .footer-note { text-align: center; margin-top: 15px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>👑 MAXO Control Panel</h2>
        <form action="/update" method="POST">
          <label>Bot Status Text (Custom Presence):</label>
          <input type="text" name="statusText" value="👑 LISTENING TO NUROX" required>
          
          <label>Greet Message Response:</label>
          <textarea name="greetText" rows="3" required>> **YOO EVERYONE SUP?**</textarea>
          
          <button type="submit">🚀 Save & Push to GitHub</button>
        </form>
        <div class="footer-note">Private Access • Auto-Sync with Bot Repo</div>
      </div>
    </body>
    </html>
  `);
});

// Update Handler - Syncs with GitHub API
app.post('/update', async (req, res) => {
  const { statusText, greetText } = req.body;

  if (!GITHUB_TOKEN) {
    return res.status(500).send('❌ Error: GITHUB_TOKEN environment variable is not set!');
  }

  try {
    const getFileUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    // 1. Fetch File SHA & Content from GitHub
    const fileRes = await fetch(getFileUrl, {
      headers: { 
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'MAXO-Dashboard'
      }
    });
    const fileData = await fileRes.json();

    if (!fileData.sha) {
      return res.status(500).send('❌ Failed to fetch index.js file from GitHub. Check REPO_OWNER/REPO_NAME.');
    }

    let content = Buffer.from(fileData.content, 'base64').toString('utf8');

    // 2. Replace Values in index.js code
    content = content.replace(/state:\s*'.*?'/, `state: '${statusText}'`);
    content = content.replace(/await message\.channel\.send\('> \*\*.*?\*\*'\);/, `await message.channel.send('${greetText}');`);

    const updatedContentEncoded = Buffer.from(content).toString('base64');

    // 3. Commit Updated Code to GitHub
    const updateRes = await fetch(getFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MAXO-Dashboard'
      },
      body: JSON.stringify({
        message: '⚡ Update Bot Config via Private MAXO Dashboard',
        content: updatedContentEncoded,
        sha: fileData.sha
      })
    });

    if (updateRes.ok) {
      res.send(`
        <div style="background:#0f172a; color:#38bdf8; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:sans-serif;">
          <h2>✅ Changes Saved & Pushed to GitHub!</h2>
          <p style="color:#94a3b8; margin-top:10px;">Render will now automatically rebuild and deploy your bot.</p>
          <a href="/" style="margin-top:20px; color:#fff; background:#0284c7; padding:10px 20px; text-decoration:none; border-radius:6px;">Go Back</a>
        </div>
      `);
    } else {
      const errJson = await updateRes.json();
      res.status(500).send(`❌ GitHub Update Error: ${JSON.stringify(errJson)}`);
    }

  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Internal Server Error');
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Dashboard active on port ${PORT}`));
