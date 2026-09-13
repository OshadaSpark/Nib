//! Reading and writing the user's files, by absolute path. The frontend only runs the app's own
//! code (see the content security policy), so the commands take any path, as the user's editor.
//!
//! Commands run on the async runtime's threads rather than the main one, which draws the window.
//! Times are milliseconds since the Unix epoch, as JavaScript counts them.
#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri commands take their arguments by value"
)]

use std::fs::{self, Metadata, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::ipc::Response;
use tempfile::NamedTempFile;

/// Why a command failed, as far as the frontend tells failures apart.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    /// No file there, or a directory where a file was expected.
    NotFound,
    /// The name is taken.
    AlreadyExists,
    Other,
}

#[derive(Debug, Serialize)]
pub struct Error {
    kind: ErrorKind,
    message: String,
}

impl Error {
    fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

impl From<io::Error> for Error {
    fn from(error: io::Error) -> Self {
        let kind = match error.kind() {
            io::ErrorKind::NotFound
            | io::ErrorKind::IsADirectory
            | io::ErrorKind::NotADirectory => ErrorKind::NotFound,
            io::ErrorKind::AlreadyExists => ErrorKind::AlreadyExists,
            _ => ErrorKind::Other,
        };
        Self::new(kind, error.to_string())
    }
}

type Result<T> = std::result::Result<T, Error>;

fn modified_time(metadata: &Metadata) -> Result<f64> {
    let since_epoch = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| Error::new(ErrorKind::Other, error.to_string()))?;
    Ok(since_epoch.as_secs_f64() * 1000.0)
}

/// An entry of a directory.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct Entry {
    name: String,
    directory: bool,
}

fn read(path: &Path) -> Result<Vec<u8>> {
    Ok(fs::read(path)?)
}

/// The file's bytes, as they are, without the overhead of JSON.
#[tauri::command(async)]
pub fn read_file(path: PathBuf) -> Result<Response> {
    read(&path).map(Response::new)
}

/// When the file was last modified.
#[tauri::command(async)]
pub fn modified(path: PathBuf) -> Result<f64> {
    let metadata = fs::metadata(path)?;
    if metadata.is_dir() {
        return Err(Error::new(ErrorKind::NotFound, "Is a directory"));
    }
    modified_time(&metadata)
}

/// Writes `contents` to the file, creating it if need be, and returns its modified time. The text
/// goes to a temporary file beside it first, which then replaces it, so a failed write leaves the
/// file as it was. A symbolic link stays one: the file it points to is replaced.
#[tauri::command(async)]
pub fn write_file(path: PathBuf, contents: String) -> Result<f64> {
    let target = match fs::canonicalize(&path) {
        Ok(target) => target,
        Err(error) if error.kind() == io::ErrorKind::NotFound => path,
        Err(error) => return Err(error.into()),
    };
    let directory = target
        .parent()
        .ok_or_else(|| Error::new(ErrorKind::Other, "No directory to write to"))?;
    let mut temporary = NamedTempFile::new_in(directory)?;
    temporary.write_all(contents.as_bytes())?;
    // The replacement is a new file, which would otherwise get default permissions.
    if let Ok(existing) = fs::metadata(&target) {
        temporary
            .as_file()
            .set_permissions(existing.permissions())?;
    }
    temporary.as_file().sync_all()?;
    let file = temporary.persist(&target).map_err(|error| error.error)?;
    modified_time(&file.metadata()?)
}

/// The directory's entries with UTF-8 names, following symbolic links (broken ones are left out).
#[tauri::command(async)]
pub fn list_dir(path: PathBuf) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let (Ok(name), Ok(metadata)) =
            (entry.file_name().into_string(), fs::metadata(entry.path()))
        else {
            continue;
        };
        entries.push(Entry {
            name,
            directory: metadata.is_dir(),
        });
    }
    Ok(entries)
}

/// Creates an empty file and returns its modified time. Fails if the name is taken.
#[tauri::command(async)]
pub fn create_file(path: PathBuf) -> Result<f64> {
    let file = OpenOptions::new().write(true).create_new(true).open(path)?;
    modified_time(&file.metadata()?)
}

/// Moves the file at `from` to `to` and returns its modified time. Fails if `to` is taken, unless
/// by the file itself, as when only the case of its name changes on a case-insensitive disk.
#[tauri::command(async)]
pub fn rename_file(from: PathBuf, to: PathBuf) -> Result<f64> {
    if to.try_exists()? && !same_file::is_same_file(&from, &to)? {
        return Err(Error::new(
            ErrorKind::AlreadyExists,
            format!("{} already exists", to.display()),
        ));
    }
    fs::rename(&from, &to)?;
    modified_time(&fs::metadata(&to)?)
}

/// Moves the file to the Trash, from where the user can put it back.
#[tauri::command(async)]
pub fn trash(path: PathBuf) -> Result<()> {
    if !path.try_exists()? {
        return Err(Error::new(ErrorKind::NotFound, "No such file"));
    }
    trash::delete(path).map_err(|error| Error::new(ErrorKind::Other, error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn directory() -> TempDir {
        TempDir::new().expect("a temporary directory")
    }

    fn kind<T: std::fmt::Debug>(result: Result<T>) -> ErrorKind {
        result.expect_err("an error").kind
    }

    #[test]
    fn reads_files_and_reports_missing_ones() {
        let dir = directory();
        let path = dir.path().join("notes.md");
        fs::write(&path, "# Notes").unwrap();

        assert_eq!(read(&path).unwrap(), b"# Notes");
        assert_eq!(kind(read(&dir.path().join("none.md"))), ErrorKind::NotFound);
        assert_eq!(kind(read(dir.path())), ErrorKind::NotFound);
    }

    #[test]
    fn tells_when_a_file_was_modified() {
        let dir = directory();
        let path = dir.path().join("notes.md");
        fs::write(&path, "").unwrap();

        assert!(modified(path).unwrap() > 0.0);
        assert_eq!(kind(modified(dir.path().into())), ErrorKind::NotFound);
    }

    #[test]
    fn writes_files_through_a_temporary_file() {
        let dir = directory();
        let path = dir.path().join("notes.md");
        fs::write(&path, "old").unwrap();

        let time = write_file(path.clone(), "new".into()).unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert!((time - modified(path).unwrap()).abs() < f64::EPSILON);
        // Nothing left behind.
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn creates_files_it_writes() {
        let dir = directory();
        let path = dir.path().join("new.md");

        write_file(path.clone(), "text".into()).unwrap();

        assert_eq!(fs::read_to_string(path).unwrap(), "text");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_permissions_and_symbolic_links() {
        use std::os::unix::fs::{PermissionsExt, symlink};
        let dir = directory();
        let path = dir.path().join("notes.md");
        let link = dir.path().join("link.md");
        fs::write(&path, "old").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        symlink(&path, &link).unwrap();

        write_file(link.clone(), "new".into()).unwrap();

        assert!(fs::symlink_metadata(&link).unwrap().is_symlink());
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn lists_directories() {
        let dir = directory();
        fs::write(dir.path().join("a.md"), "").unwrap();
        fs::create_dir(dir.path().join("notes")).unwrap();

        let mut entries = list_dir(dir.path().into()).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));

        assert_eq!(
            entries,
            [
                Entry {
                    name: "a.md".into(),
                    directory: false
                },
                Entry {
                    name: "notes".into(),
                    directory: true
                },
            ]
        );
    }

    #[test]
    fn creates_files_only_under_free_names() {
        let dir = directory();
        let path = dir.path().join("new.md");

        assert!(create_file(path.clone()).is_ok());
        assert_eq!(kind(create_file(path)), ErrorKind::AlreadyExists);
    }

    #[test]
    fn renames_files_only_to_free_names() {
        let dir = directory();
        let from = dir.path().join("a.md");
        let taken = dir.path().join("b.md");
        fs::write(&from, "a").unwrap();
        fs::write(&taken, "b").unwrap();

        assert_eq!(
            kind(rename_file(from.clone(), taken.clone())),
            ErrorKind::AlreadyExists
        );
        assert_eq!(fs::read_to_string(&taken).unwrap(), "b");

        let to = dir.path().join("c.md");
        rename_file(from.clone(), to.clone()).unwrap();
        assert!(!from.exists());
        assert_eq!(fs::read_to_string(to).unwrap(), "a");
    }

    #[test]
    fn changes_only_the_case_of_a_name() {
        let dir = directory();
        let from = dir.path().join("notes.md");
        let to = dir.path().join("Notes.md");
        fs::write(&from, "text").unwrap();

        rename_file(from, to.clone()).unwrap();

        let names: Vec<_> = list_dir(dir.path().into())
            .unwrap()
            .into_iter()
            .map(|entry| entry.name)
            .collect();
        assert_eq!(names, ["Notes.md"]);
        assert_eq!(fs::read_to_string(to).unwrap(), "text");
    }

    #[test]
    fn trashes_only_files_that_exist() {
        let dir = directory();
        assert_eq!(kind(trash(dir.path().join("none.md"))), ErrorKind::NotFound);
    }
}
