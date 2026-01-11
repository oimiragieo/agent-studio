---
name: google-drive
description: Google Drive file operations and management
allowed-tools: [Bash, Read, WebFetch]
---

# Google Drive Skill

## Overview

Google Drive file management. 90%+ context savings.

## Requirements

- GOOGLE_DRIVE_CREDENTIALS or OAuth2 setup

## Tools (Progressive Disclosure)

### Files

| Tool     | Description        | Confirmation |
| -------- | ------------------ | ------------ |
| list     | List files/folders | No           |
| search   | Search files       | No           |
| download | Download file      | No           |
| upload   | Upload file        | Yes          |
| delete   | Delete file        | **REQUIRED** |

### Folders

| Tool          | Description      | Confirmation |
| ------------- | ---------------- | ------------ |
| create-folder | Create folder    | Yes          |
| move          | Move file/folder | Yes          |

### Sharing

| Tool            | Description      |
| --------------- | ---------------- |
| get-permissions | View permissions |
| share           | Share file       |

### BLOCKED

| Tool        | Status      |
| ----------- | ----------- |
| empty-trash | **BLOCKED** |

## Agent Integration

- **analyst** (primary): Document research
- **technical-writer** (secondary): Documentation
