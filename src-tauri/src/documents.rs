use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub const MAX_BYTES: u64 = 64 * 1024 * 1024;
const MAX_OPEN: usize = 64;

#[derive(Clone, Serialize)]
pub struct Document {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recent {
    pub path: String,
    pub name: String,
    pub opened_at: u64,
}

#[derive(Default, Serialize)]
pub struct OpenBatch {
    pub files: Vec<Document>,
    pub errors: Vec<String>,
}

#[derive(Default)]
pub struct Documents {
    // Handles bind a user's choice to an already-open file. Replacing a symlink
    // or renaming a path later cannot redirect a read to a different document.
    open: HashMap<String, (PathBuf, fs::File)>,
    pub pending: OpenBatch,
    pub recent: Vec<Recent>,
    history_path: PathBuf,
}

impl Documents {
    pub fn new(data_dir: PathBuf) -> Self {
        let history_path = data_dir.join("recent.json");
        let recent = fs::read(&history_path)
            .ok()
            .filter(|data| data.len() < 64 * 1024)
            .and_then(|data| serde_json::from_slice::<Vec<Recent>>(&data).ok())
            .unwrap_or_default();
        Self {
            history_path,
            recent: recent.into_iter().take(12).collect(),
            ..Self::default()
        }
    }
    pub fn grant(&mut self, path: &Path) -> Result<Document, String> {
        if self.open.len() >= MAX_OPEN {
            return Err("Close a document before opening more (64 tab limit).".into());
        }
        let canonical =
            fs::canonicalize(path).map_err(|_| "The file could not be found or accessed.")?;
        let metadata = fs::metadata(&canonical).map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            return Err("Only regular files can be opened.".into());
        }
        if metadata.len() > MAX_BYTES {
            return Err("This file exceeds the 64 MB limit.".into());
        }
        let file =
            fs::File::open(&canonical).map_err(|_| "The file could not be opened for reading.")?;
        let metadata = file.metadata().map_err(|e| e.to_string())?;
        if !metadata.is_file() || metadata.len() > MAX_BYTES {
            return Err("The file changed while it was being opened.".into());
        }
        let path_string = canonical.to_string_lossy().to_string();
        let name = canonical
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let id = uuid::Uuid::new_v4().to_string();
        let document = Document {
            id: id.clone(),
            path: path_string.clone(),
            name: name.clone(),
            size: metadata.len(),
        };
        self.open.insert(id, (canonical, file));
        self.recent.retain(|item| item.path != path_string);
        self.recent.insert(
            0,
            Recent {
                path: path_string,
                name,
                opened_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            },
        );
        self.recent.truncate(12);
        // Failure to save history should not prevent reading an otherwise valid file.
        let _ = self.persist();
        Ok(document)
    }
    pub fn grant_many(&mut self, paths: impl IntoIterator<Item = PathBuf>) -> OpenBatch {
        let mut batch = OpenBatch::default();
        for path in paths {
            match self.grant(&path) {
                Ok(file) => batch.files.push(file),
                Err(error) => batch.errors.push(format!(
                    "{}: {error}",
                    path.file_name().unwrap_or_default().to_string_lossy()
                )),
            }
        }
        batch
    }
    pub fn queue(&mut self, paths: impl IntoIterator<Item = PathBuf>) {
        let batch = self.grant_many(paths);
        self.pending.files.extend(batch.files);
        self.pending.errors.extend(batch.errors);
    }
    pub fn read(&self, id: &str) -> Result<Vec<u8>, String> {
        use std::io::{Seek, SeekFrom};
        let (_, handle) = self
            .open
            .get(id)
            .ok_or("This document is no longer open.")?;
        let mut file = handle.try_clone().map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        file.take(MAX_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("The file exceeds the 64 MB limit.".into());
        }
        Ok(bytes)
    }
    pub fn path(&self, id: &str) -> Result<PathBuf, String> {
        let (path, _) = self
            .open
            .get(id)
            .ok_or("This document is no longer open.")?;
        if fs::canonicalize(path).map_err(|e| e.to_string())? != *path {
            return Err("The original file has moved.".into());
        }
        Ok(path.clone())
    }
    pub fn release(&mut self, id: &str) {
        self.open.remove(id);
    }
    pub fn forget(&mut self, path: Option<&str>) -> Result<(), String> {
        self.recent
            .retain(|item| path.is_some_and(|path| path != item.path));
        self.persist()
    }
    fn persist(&self) -> Result<(), String> {
        if let Some(parent) = self.history_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let bytes = serde_json::to_vec(&self.recent).map_err(|e| e.to_string())?;
        fs::write(&self.history_path, bytes).map_err(|e| e.to_string())
    }
}

pub fn argument_paths(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            let path = PathBuf::from(arg);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relative_arguments_use_invoking_directory() {
        assert_eq!(
            argument_paths(
                vec!["folio".into(), "--flag".into(), "a b.txt".into()],
                Path::new("documents")
            ),
            vec![PathBuf::from("documents/a b.txt")]
        );
    }
    #[test]
    fn grants_are_required_and_revocable() {
        let dir = std::env::temp_dir().join(format!("folio-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("sample.txt");
        fs::write(&file, "hello").unwrap();
        let mut docs = Documents::new(dir.join("state"));
        assert!(docs.read("invented").is_err());
        assert!(docs.grant(&dir).is_err());
        let grant = docs.grant(&file).unwrap();
        assert_eq!(docs.read(&grant.id).unwrap(), b"hello");
        assert_eq!(docs.read(&grant.id).unwrap(), b"hello");
        docs.release(&grant.id);
        assert!(docs.read(&grant.id).is_err());
        docs.forget(None).unwrap();
        assert!(Documents::new(dir.join("state")).recent.is_empty());
        fs::remove_dir_all(dir).unwrap();
    }
}
