use chrono::{Duration, Local, NaiveDate};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ==================== 数据模型 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Baby {
    pub id: i64,
    pub name: String,
    pub nickname: Option<String>,
    pub birth_date: String,
    pub gender: String,
    pub avatar_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewBaby {
    pub name: String,
    pub nickname: Option<String>,
    pub birth_date: String,
    pub gender: String,
    pub avatar_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i64,
    pub baby_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub period_days: i64,
    pub status: String,
    pub output_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewProject {
    pub baby_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub period_days: i64,
    pub status: String,
    pub output_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Period {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub period_type: String,
    pub sort_order: i64,
    pub selected_photo_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewPeriod {
    pub project_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub period_type: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Photo {
    pub id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
    pub description: Option<String>,
    pub is_selected: bool,
    pub is_final: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Video {
    pub id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub duration: f64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFrame {
    pub id: i64,
    pub video_id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub time_seconds: f64,
    pub is_selected: bool,
    pub is_final: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportRecord {
    pub id: i64,
    pub project_id: i64,
    pub output_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub duration: f64,
    pub resolution: String,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
}

// ==================== 数据库 ====================

pub struct Database {
    conn: Option<Connection>,
}

impl Database {
    pub fn new() -> Self {
        Database { conn: None }
    }

    fn get_conn(&self) -> &Connection {
        self.conn.as_ref().expect("Database not initialized")
    }

    fn get_db_path() -> PathBuf {
        let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("baby-growth-video");
        std::fs::create_dir_all(&path).ok();
        path.push("app.db");
        path
    }

    pub fn init(&mut self) -> Result<()> {
        let db_path = Self::get_db_path();
        let conn = Connection::open(db_path)?;
        self.conn = Some(conn);
        self.create_tables()?;
        Ok(())
    }

    fn create_tables(&self) -> Result<()> {
        let conn = self.get_conn();

        // 宝宝表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS babies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                nickname TEXT,
                birth_date TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT 'unknown',
                avatar_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 项目表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                baby_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                period_days INTEGER NOT NULL DEFAULT 7,
                status TEXT NOT NULL DEFAULT 'draft',
                output_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 周期表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                period_type TEXT NOT NULL DEFAULT 'auto',
                sort_order INTEGER NOT NULL DEFAULT 0,
                selected_photo_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 照片表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                width INTEGER NOT NULL DEFAULT 0,
                height INTEGER NOT NULL DEFAULT 0,
                taken_at TEXT,
                description TEXT,
                is_selected INTEGER NOT NULL DEFAULT 0,
                is_final INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 视频表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                duration REAL NOT NULL DEFAULT 0,
                width INTEGER NOT NULL DEFAULT 0,
                height INTEGER NOT NULL DEFAULT 0,
                taken_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 视频截图表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS video_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id INTEGER NOT NULL,
                period_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                time_seconds REAL NOT NULL DEFAULT 0,
                is_selected INTEGER NOT NULL DEFAULT 0,
                is_final INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 导出记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS export_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                output_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                duration REAL NOT NULL DEFAULT 0,
                resolution TEXT NOT NULL DEFAULT '1080p',
                status TEXT NOT NULL DEFAULT 'processing',
                error_message TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )",
            [],
        )?;

        Ok(())
    }

    fn now() -> String {
        Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
    }

    // ==================== 宝宝操作 ====================

    pub fn get_babies(&self) -> Result<Vec<Baby>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare("SELECT * FROM babies ORDER BY created_at DESC")?;
        let babies = stmt.query_map([], |row| {
            Ok(Baby {
                id: row.get(0)?,
                name: row.get(1)?,
                nickname: row.get(2)?,
                birth_date: row.get(3)?,
                gender: row.get(4)?,
                avatar_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        babies.collect()
    }

    pub fn create_baby(&self, baby: &NewBaby) -> Result<Baby> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO babies (name, nickname, birth_date, gender, avatar_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                baby.name,
                baby.nickname,
                baby.birth_date,
                baby.gender,
                baby.avatar_path,
                &now,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_baby_by_id(id)
    }

    pub fn update_baby(&self, baby: &Baby) -> Result<Baby> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "UPDATE babies SET name = ?1, nickname = ?2, birth_date = ?3, gender = ?4, avatar_path = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                baby.name,
                baby.nickname,
                baby.birth_date,
                baby.gender,
                baby.avatar_path,
                &now,
                baby.id,
            ],
        )?;
        self.get_baby_by_id(baby.id)
    }

    pub fn delete_baby(&self, baby_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM babies WHERE id = ?1", params![baby_id])?;
        Ok(())
    }

    fn get_baby_by_id(&self, id: i64) -> Result<Baby> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM babies WHERE id = ?1", params![id], |row| {
            Ok(Baby {
                id: row.get(0)?,
                name: row.get(1)?,
                nickname: row.get(2)?,
                birth_date: row.get(3)?,
                gender: row.get(4)?,
                avatar_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
    }

    // ==================== 项目操作 ====================

    pub fn get_projects(&self, baby_id: i64) -> Result<Vec<Project>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM projects WHERE baby_id = ?1 ORDER BY created_at DESC",
        )?;
        let projects = stmt.query_map(params![baby_id], |row| {
            Ok(Project {
                id: row.get(0)?,
                baby_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                period_days: row.get(4)?,
                status: row.get(5)?,
                output_path: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        projects.collect()
    }

    pub fn create_project(&self, project: &NewProject) -> Result<Project> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO projects (baby_id, name, description, period_days, status, output_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project.baby_id,
                project.name,
                project.description,
                project.period_days,
                project.status,
                project.output_path,
                &now,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_project_by_id(id)
    }

    pub fn update_project(&self, project: &Project) -> Result<Project> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "UPDATE projects SET name = ?1, description = ?2, period_days = ?3, status = ?4, output_path = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                project.name,
                project.description,
                project.period_days,
                project.status,
                project.output_path,
                &now,
                project.id,
            ],
        )?;
        self.get_project_by_id(project.id)
    }

    pub fn delete_project(&self, project_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id])?;
        Ok(())
    }

    fn get_project_by_id(&self, id: i64) -> Result<Project> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM projects WHERE id = ?1", params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                baby_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                period_days: row.get(4)?,
                status: row.get(5)?,
                output_path: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
    }

    // ==================== 周期操作 ====================

    pub fn get_periods(&self, project_id: i64) -> Result<Vec<Period>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM periods WHERE project_id = ?1 ORDER BY sort_order ASC, id ASC",
        )?;
        let periods = stmt.query_map(params![project_id], |row| {
            Ok(Period {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                start_date: row.get(3)?,
                end_date: row.get(4)?,
                period_type: row.get(5)?,
                sort_order: row.get(6)?,
                selected_photo_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        periods.collect()
    }

    pub fn generate_periods(
        &self,
        project_id: i64,
        birth_date: &str,
        period_days: i64,
    ) -> Result<Vec<Period>> {
        let conn = self.get_conn();
        let now = Self::now();

        // 解析出生日期
        let birth = NaiveDate::parse_from_str(birth_date, "%Y-%m-%d")
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

        let today = Local::now().date_naive();
        let mut week_num = 1;
        let mut current_start = birth;

        while current_start <= today {
            let current_end = current_start + Duration::days(period_days - 1);
            let name = format!("第{}周", week_num);

            conn.execute(
                "INSERT INTO periods (project_id, name, start_date, end_date, period_type, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    project_id,
                    name,
                    current_start.format("%Y-%m-%d").to_string(),
                    current_end.format("%Y-%m-%d").to_string(),
                    "auto",
                    week_num - 1,
                    &now,
                    &now,
                ],
            )?;

            current_start = current_end + Duration::days(1);
            week_num += 1;
        }

        self.get_periods(project_id)
    }

    pub fn create_period(&self, period: &NewPeriod) -> Result<Period> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO periods (project_id, name, start_date, end_date, period_type, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                period.project_id,
                period.name,
                period.start_date,
                period.end_date,
                period.period_type,
                period.sort_order,
                &now,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_period_by_id(id)
    }

    pub fn update_period(&self, period: &Period) -> Result<Period> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "UPDATE periods SET name = ?1, start_date = ?2, end_date = ?3, period_type = ?4, sort_order = ?5, selected_photo_id = ?6, updated_at = ?7 WHERE id = ?8",
            params![
                period.name,
                period.start_date,
                period.end_date,
                period.period_type,
                period.sort_order,
                period.selected_photo_id,
                &now,
                period.id,
            ],
        )?;
        self.get_period_by_id(period.id)
    }

    pub fn delete_period(&self, period_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM periods WHERE id = ?1", params![period_id])?;
        Ok(())
    }

    fn get_period_by_id(&self, id: i64) -> Result<Period> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM periods WHERE id = ?1", params![id], |row| {
            Ok(Period {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                start_date: row.get(3)?,
                end_date: row.get(4)?,
                period_type: row.get(5)?,
                sort_order: row.get(6)?,
                selected_photo_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
    }

    // ==================== 照片操作 ====================

    pub fn get_period_photos(&self, period_id: i64) -> Result<Vec<Photo>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM photos WHERE period_id = ?1 ORDER BY taken_at ASC, id ASC",
        )?;
        let photos = stmt.query_map(params![period_id], |row| {
            Ok(Photo {
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                taken_at: row.get(7)?,
                description: row.get(8)?,
                is_selected: row.get::<_, i64>(9)? != 0,
                is_final: row.get::<_, i64>(10)? != 0,
                created_at: row.get(11)?,
            })
        })?;
        photos.collect()
    }

    pub fn add_photo(&self, photo: &NewPhoto) -> Result<Photo> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO photos (period_id, file_path, file_name, file_size, width, height, taken_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                photo.period_id,
                photo.file_path,
                photo.file_name,
                photo.file_size,
                photo.width,
                photo.height,
                photo.taken_at,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_photo_by_id(id)
    }

    pub fn update_photo(&self, photo: &Photo) -> Result<Photo> {
        let conn = self.get_conn();
        conn.execute(
            "UPDATE photos SET description = ?1, is_selected = ?2, is_final = ?3 WHERE id = ?4",
            params![
                photo.description,
                photo.is_selected as i64,
                photo.is_final as i64,
                photo.id,
            ],
        )?;
        self.get_photo_by_id(photo.id)
    }

    pub fn set_final_photo(&self, period_id: i64, photo_id: i64) -> Result<()> {
        let conn = self.get_conn();
        // 先取消该周期所有照片的final状态
        conn.execute(
            "UPDATE photos SET is_final = 0 WHERE period_id = ?1",
            params![period_id],
        )?;
        // 设置选中的照片为final
        conn.execute(
            "UPDATE photos SET is_final = 1 WHERE id = ?1",
            params![photo_id],
        )?;
        // 更新周期的selected_photo_id
        conn.execute(
            "UPDATE periods SET selected_photo_id = ?1 WHERE id = ?2",
            params![photo_id, period_id],
        )?;
        Ok(())
    }

    fn get_photo_by_id(&self, id: i64) -> Result<Photo> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM photos WHERE id = ?1", params![id], |row| {
            Ok(Photo {
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                taken_at: row.get(7)?,
                description: row.get(8)?,
                is_selected: row.get::<_, i64>(9)? != 0,
                is_final: row.get::<_, i64>(10)? != 0,
                created_at: row.get(11)?,
            })
        })
    }

    // ==================== 视频操作 ====================

    pub fn get_period_videos(&self, period_id: i64) -> Result<Vec<Video>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM videos WHERE period_id = ?1 ORDER BY taken_at ASC, id ASC",
        )?;
        let videos = stmt.query_map(params![period_id], |row| {
            Ok(Video {
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                duration: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                taken_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;
        videos.collect()
    }

    pub fn add_video(&self, video: &NewVideo) -> Result<Video> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO videos (period_id, file_path, file_name, file_size, duration, width, height, taken_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                video.period_id,
                video.file_path,
                video.file_name,
                video.file_size,
                video.duration,
                video.width,
                video.height,
                video.taken_at,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_video_by_id(id)
    }

    pub fn get_video_by_id(&self, id: i64) -> Result<Video> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM videos WHERE id = ?1", params![id], |row| {
            Ok(Video {
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                duration: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                taken_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
    }

    // ==================== 视频截图操作 ====================

    pub fn get_video_frames(&self, video_id: i64) -> Result<Vec<VideoFrame>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM video_frames WHERE video_id = ?1 ORDER BY time_seconds ASC",
        )?;
        let frames = stmt.query_map(params![video_id], |row| {
            Ok(VideoFrame {
                id: row.get(0)?,
                video_id: row.get(1)?,
                period_id: row.get(2)?,
                file_path: row.get(3)?,
                time_seconds: row.get(4)?,
                is_selected: row.get::<_, i64>(5)? != 0,
                is_final: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
            })
        })?;
        frames.collect()
    }

    pub fn set_final_video_frame(&self, period_id: i64, frame_id: i64) -> Result<()> {
        let conn = self.get_conn();
        // 先取消该周期所有截图的final状态
        conn.execute(
            "UPDATE video_frames SET is_final = 0 WHERE period_id = ?1",
            params![period_id],
        )?;
        // 设置选中的截图为final
        conn.execute(
            "UPDATE video_frames SET is_final = 1 WHERE id = ?1",
            params![frame_id],
        )?;
        Ok(())
    }

    pub fn add_video_frame(&self, frame: &NewVideoFrame) -> Result<VideoFrame> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO video_frames (video_id, period_id, file_path, time_seconds, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                frame.video_id,
                frame.period_id,
                frame.file_path,
                frame.time_seconds,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_video_frame_by_id(id)
    }

    fn get_video_frame_by_id(&self, id: i64) -> Result<VideoFrame> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM video_frames WHERE id = ?1", params![id], |row| {
            Ok(VideoFrame {
                id: row.get(0)?,
                video_id: row.get(1)?,
                period_id: row.get(2)?,
                file_path: row.get(3)?,
                time_seconds: row.get(4)?,
                is_selected: row.get::<_, i64>(5)? != 0,
                is_final: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
            })
        })
    }

    // ==================== 导出记录操作 ====================

    pub fn get_export_records(&self, project_id: i64) -> Result<Vec<ExportRecord>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM export_records WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;
        let records = stmt.query_map(params![project_id], |row| {
            Ok(ExportRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                output_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                duration: row.get(5)?,
                resolution: row.get(6)?,
                status: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;
        records.collect()
    }

    pub fn create_export_record(&self, record: &NewExportRecord) -> Result<ExportRecord> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO export_records (project_id, output_path, file_name, file_size, duration, resolution, status, error_message, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                record.project_id,
                record.output_path,
                record.file_name,
                record.file_size,
                record.duration,
                record.resolution,
                record.status,
                record.error_message,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        self.get_export_record_by_id(id)
    }

    fn get_export_record_by_id(&self, id: i64) -> Result<ExportRecord> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM export_records WHERE id = ?1", params![id], |row| {
            Ok(ExportRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                output_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                duration: row.get(5)?,
                resolution: row.get(6)?,
                status: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
    }
}

// ==================== 辅助结构体 ====================

pub struct NewPhoto {
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
}

pub struct NewVideo {
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub duration: f64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
}

pub struct NewVideoFrame {
    pub video_id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub time_seconds: f64,
}

pub struct NewExportRecord {
    pub project_id: i64,
    pub output_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub duration: f64,
    pub resolution: String,
    pub status: String,
    pub error_message: Option<String>,
}
