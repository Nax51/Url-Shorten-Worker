# GitHub SSH 連接設置指南

在 WSL 或 Linux 系統中設置 GitHub SSH 連接的完整步驟。

## 📋 前置條件

- 已經在 GitHub 中添加了 SSH 公鑰
- 擁有對應的 SSH 私鑰文件

## 🔧 設置步驟

### 1. 創建 SSH 目錄並複製私鑰

```bash
# 創建 SSH 目錄
mkdir -p ~/.ssh

# 複製私鑰到 SSH 目錄
cp /path/to/your/id_rsa ~/.ssh/id_rsa
```

### 2. 設置正確的文件權限

```bash
# 設置私鑰文件權限（重要：必須是 600）
chmod 600 ~/.ssh/id_rsa
```

### 3. 啟動 SSH Agent 並添加私鑰

```bash
# 啟動 SSH agent
eval "$(ssh-agent -s)"

# 添加私鑰到 SSH agent
ssh-add ~/.ssh/id_rsa
```

### 4. 添加 GitHub 到已知主機

```bash
# 添加 GitHub 的 SSH 主機密鑰到 known_hosts
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
```

### 5. 測試 GitHub SSH 連接

```bash
# 測試 SSH 連接
ssh -T git@github.com
```

**成功的回應應該是：**
```
Hi [username]! You've successfully authenticated, but GitHub does not provide shell access.
```

### 6. 配置 Git 用戶信息

```bash
# 設置 Git 用戶名和郵箱
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 7. 自動載入 SSH 密鑰（可選）

將以下內容添加到 `~/.bashrc` 文件中，這樣每次開啟終端都會自動載入 SSH 密鑰：

```bash
echo 'eval "$(ssh-agent -s)" > /dev/null && ssh-add ~/.ssh/id_rsa > /dev/null 2>&1' >> ~/.bashrc
```

## 🛠️ 常用命令

### 查看已載入的 SSH 密鑰
```bash
ssh-add -l
```

### 從 SSH agent 中移除所有密鑰
```bash
ssh-add -D
```

### 查看 Git 遠程倉庫配置
```bash
git remote -v
```

### 更改遠程倉庫 URL 為 SSH
```bash
# 如果當前使用 HTTPS，改為 SSH
git remote set-url origin git@github.com:username/repository.git
```

## 🚨 故障排除

### 問題 1: "Permission denied (publickey)"
**解決方案：**
1. 確認私鑰文件權限是 600
2. 確認 SSH agent 正在運行
3. 確認私鑰已添加到 SSH agent
4. 確認 GitHub 上有對應的公鑰

### 問題 2: "Host key verification failed"
**解決方案：**
```bash
# 重新添加 GitHub 主機密鑰
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
```

### 問題 3: "Could not open a connection to your authentication agent"
**解決方案：**
```bash
# 重新啟動 SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa
```

## 📝 文件權限說明

SSH 對文件權限要求很嚴格：

- `~/.ssh/` 目錄：權限應為 700
- `~/.ssh/id_rsa` 私鑰：權限應為 600
- `~/.ssh/id_rsa.pub` 公鑰：權限應為 644
- `~/.ssh/known_hosts`：權限應為 644

```bash
# 設置所有正確權限
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 644 ~/.ssh/known_hosts
```

## 🔍 驗證設置

完成所有設置後，可以通過以下命令驗證：

```bash
# 1. 檢查 SSH agent 狀態
ssh-add -l

# 2. 測試 GitHub 連接
ssh -T git@github.com

# 3. 檢查 Git 配置
git config --global --list

# 4. 測試 Git 操作
git status
git pull
git push
```

## 💡 提示

1. **私鑰安全：** 絕對不要分享或提交私鑰文件到版本控制系統
2. **定期更新：** 建議定期更新 SSH 密鑰對
3. **備份：** 保留私鑰的安全備份
4. **多設備：** 每個設備應使用不同的 SSH 密鑰對

---

**注意：** 此文檔基於 WSL/Linux 環境。如果在其他操作系統上操作，部分命令可能需要調整。