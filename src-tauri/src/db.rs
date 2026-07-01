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
pub struct PeriodStats {
    pub period_id: i64,
    pub photo_count: i64,
    pub video_count: i64,
    pub pending_count: i64,
    pub has_final: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Thumbnail {
    pub id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub original_path: String,
    pub original_file_name: String,
    pub original_width: i64,
    pub original_height: i64,
    pub original_file_size: i64,
    pub base64_data: Option<String>,
    pub width: i64,
    pub height: i64,
    pub is_selected: bool,
    pub is_final: bool,
    pub taken_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewThumbnail {
    pub project_id: i64,
    pub period_id: i64,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub original_path: String,
    pub original_file_name: String,
    pub original_width: i64,
    pub original_height: i64,
    pub original_file_size: i64,
    pub base64_data: Option<String>,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFrameTemp {
    pub id: i64,
    pub video_id: i64,
    pub period_id: i64,
    pub time_seconds: f64,
    pub temp_thumb_path: String,
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
        
        if !path.exists() {
            std::fs::create_dir_all(&path).ok();
        }
        
        path.push("app.db");
        path
    }

    pub fn init(&mut self) -> Result<()> {
        let db_path = Self::get_db_path();
        let conn = Connection::open(db_path)?;

        // 并发安全 & 数据完整性 PRAGMA
        conn.pragma_update(None, "journal_mode", "WAL")?;       // 读写不互斥
        conn.pragma_update(None, "foreign_keys", "ON")?;        // 强制外键约束
        conn.pragma_update(None, "busy_timeout", "5000")?;      // 写冲突等待 5s
        conn.pragma_update(None, "synchronous", "NORMAL")?;     // WAL 模式下安全加速

        self.conn = Some(conn);
        self.create_tables()?;
        self.run_migrations()?;
        Ok(())
    }

    /// 向后兼容：对旧数据库补加缺失的列（CREATE TABLE IF NOT EXISTS 不会修改已有表）
    fn run_migrations(&self) -> Result<()> {
        let conn = self.get_conn();

        // Migration 1: 修复 videos 表结构（旧版本可能有多余的列或不正确的外键）
        // 检查 videos 表是否有多余的列（如 project_id），如果有则重建表
        let mut stmt = conn.prepare("PRAGMA table_info(videos)")?;
        let columns: Vec<String> = stmt.query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();
        
        let expected_columns = [
            "id", "period_id", "file_path", "file_name", 
            "file_size", "duration", "width", "height", 
            "taken_at", "created_at"
        ];
        
        let has_extra_columns = columns.iter().any(|c| !expected_columns.contains(&c.as_str()));
        let has_missing_columns = expected_columns.iter().any(|c| !columns.contains(&c.to_string()));
        
        if has_extra_columns || has_missing_columns {
            eprintln!("检测到 videos 表结构不匹配，正在重建...");
            
            // 开启事务
            conn.execute("BEGIN TRANSACTION", [])?;
            
            // 1. 创建新表
            conn.execute(
                "CREATE TABLE IF NOT EXISTS videos_new (
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
            
            // 2. 复制数据（只复制两表共有的列）
            let common_columns: Vec<&str> = expected_columns.iter()
                .filter(|c| columns.contains(&c.to_string()))
                .copied()
                .collect();
            
            if !common_columns.is_empty() {
                let cols_str = common_columns.join(", ");
                let sql = format!("INSERT INTO videos_new ({}) SELECT {} FROM videos", cols_str, cols_str);
                conn.execute(&sql, [])?;
            }
            
            // 3. 删除旧表
            conn.execute("DROP TABLE videos", [])?;
            
            // 4. 重命名新表
            conn.execute("ALTER TABLE videos_new RENAME TO videos", [])?;
            
            // 5. 提交事务
            conn.execute("COMMIT", [])?;
            
            eprintln!("videos 表重建完成");
        }

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

        // 缩略图表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS thumbnails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                period_id INTEGER NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'scan',
                source_id INTEGER,
                original_path TEXT NOT NULL,
                original_file_name TEXT NOT NULL,
                original_width INTEGER NOT NULL DEFAULT 0,
                original_height INTEGER NOT NULL DEFAULT 0,
                original_file_size INTEGER NOT NULL DEFAULT 0,
                base64_data TEXT,
                width INTEGER NOT NULL DEFAULT 0,
                height INTEGER NOT NULL DEFAULT 0,
                is_selected INTEGER NOT NULL DEFAULT 0,
                is_final INTEGER NOT NULL DEFAULT 0,
                taken_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
                FOREIGN KEY (source_id) REFERENCES videos(id) ON DELETE CASCADE
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

        // 视频帧临时表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS video_frame_temp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id INTEGER NOT NULL,
                period_id INTEGER NOT NULL,
                time_seconds REAL NOT NULL,
                temp_thumb_path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 设置表 (key-value)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
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

    pub fn get_period(&self, period_id: i64) -> Result<Period> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare("SELECT * FROM periods WHERE id = ?1")?;
        let period = stmt.query_row(params![period_id], |row| {
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
        Ok(period)
    }

    pub fn get_period_stats(&self, project_id: i64) -> Result<Vec<PeriodStats>> {
        let conn = self.get_conn();
        let periods = self.get_periods(project_id)?;
        let mut stats = Vec::with_capacity(periods.len());

        for period in periods {
            let photo_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM thumbnails WHERE period_id = ?1 AND source_type = 'scan'",
                params![period.id],
                |row| row.get(0),
            ).unwrap_or(0);

            let video_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM videos WHERE period_id = ?1",
                params![period.id],
                |row| row.get(0),
            ).unwrap_or(0);

            let pending_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM thumbnails WHERE period_id = ?1 AND is_selected = 1",
                params![period.id],
                |row| row.get(0),
            ).unwrap_or(0);

            let has_final: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM thumbnails WHERE period_id = ?1 AND is_final = 1)",
                params![period.id],
                |row| row.get(0),
            ).unwrap_or(false);

            stats.push(PeriodStats {
                period_id: period.id,
                photo_count,
                video_count,
                pending_count,
                has_final,
            });
        }

        Ok(stats)
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

    // ==================== 缩略图操作 ====================

    pub fn get_period_thumbnails(&self, period_id: i64) -> Result<Vec<Thumbnail>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM thumbnails WHERE period_id = ?1 ORDER BY taken_at ASC, id ASC",
        )?;
        let thumbnails = stmt.query_map(params![period_id], |row| {
            Ok(Thumbnail {
                id: row.get(0)?,
                project_id: row.get(1)?,
                period_id: row.get(2)?,
                source_type: row.get(3)?,
                source_id: row.get(4)?,
                original_path: row.get(5)?,
                original_file_name: row.get(6)?,
                original_width: row.get(7)?,
                original_height: row.get(8)?,
                original_file_size: row.get(9)?,
                base64_data: row.get(10)?,
                width: row.get(11)?,
                height: row.get(12)?,
                is_selected: row.get::<_, i64>(13)? != 0,
                is_final: row.get::<_, i64>(14)? != 0,
                taken_at: row.get(15)?,
                created_at: row.get(16)?,
            })
        })?;
        thumbnails.collect()
    }

    pub fn add_thumbnails(&self, thumbnails: &[NewThumbnail]) -> Result<Vec<Thumbnail>> {
        let conn = self.get_conn();
        let now = Self::now();
        let mut result = Vec::with_capacity(thumbnails.len());

        conn.execute("BEGIN TRANSACTION", params![])?;

        for thumbnail in thumbnails {
            match conn.execute(
                "INSERT INTO thumbnails (project_id, period_id, source_type, source_id, original_path, original_file_name, original_width, original_height, original_file_size, base64_data, width, height, taken_at, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    thumbnail.project_id,
                    thumbnail.period_id,
                    thumbnail.source_type,
                    thumbnail.source_id,
                    thumbnail.original_path,
                    thumbnail.original_file_name,
                    thumbnail.original_width,
                    thumbnail.original_height,
                    thumbnail.original_file_size,
                    thumbnail.base64_data,
                    thumbnail.width,
                    thumbnail.height,
                    thumbnail.taken_at,
                    &now,
                ],
            ) {
                Ok(_) => {
                    let id = conn.last_insert_rowid();
                    match self.get_thumbnail_by_id(id) {
                        Ok(thumbnail) => result.push(thumbnail),
                        Err(e) => {
                            conn.execute("ROLLBACK", params![]).ok();
                            return Err(e);
                        }
                    }
                }
                Err(e) => {
                    conn.execute("ROLLBACK", params![]).ok();
                    return Err(e);
                }
            }
        }

        conn.execute("COMMIT", params![])?;
        Ok(result)
    }

    pub fn update_thumbnail(&self, thumbnail: &Thumbnail) -> Result<Thumbnail> {
        let conn = self.get_conn();
        conn.execute(
            "UPDATE thumbnails SET is_selected = ?1, is_final = ?2 WHERE id = ?3",
            params![
                thumbnail.is_selected as i64,
                thumbnail.is_final as i64,
                thumbnail.id,
            ],
        )?;
        self.get_thumbnail_by_id(thumbnail.id)
    }

    pub fn set_final_thumbnail(&self, period_id: i64, thumbnail_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute(
            "UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1",
            params![period_id],
        )?;
        conn.execute(
            "UPDATE thumbnails SET is_final = 1 WHERE id = ?1",
            params![thumbnail_id],
        )?;
        conn.execute(
            "UPDATE periods SET selected_photo_id = ?1 WHERE id = ?2",
            params![thumbnail_id, period_id],
        )?;
        Ok(())
    }

    pub fn cancel_final_thumbnail(&self, period_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute(
            "UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1",
            params![period_id],
        )?;
        conn.execute(
            "UPDATE periods SET selected_photo_id = NULL WHERE id = ?1",
            params![period_id],
        )?;
        Ok(())
    }

    pub fn delete_thumbnail(&self, thumbnail_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![thumbnail_id])?;
        Ok(())
    }

    pub fn delete_period_thumbnails(&self, period_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM thumbnails WHERE period_id = ?1", params![period_id])?;
        Ok(())
    }

    pub fn get_thumbnail_by_id(&self, id: i64) -> Result<Thumbnail> {
        let conn = self.get_conn();
        conn.query_row("SELECT * FROM thumbnails WHERE id = ?1", params![id], |row| {
            Ok(Thumbnail {
                id: row.get(0)?,
                project_id: row.get(1)?,
                period_id: row.get(2)?,
                source_type: row.get(3)?,
                source_id: row.get(4)?,
                original_path: row.get(5)?,
                original_file_name: row.get(6)?,
                original_width: row.get(7)?,
                original_height: row.get(8)?,
                original_file_size: row.get(9)?,
                base64_data: row.get(10)?,
                width: row.get(11)?,
                height: row.get(12)?,
                is_selected: row.get::<_, i64>(13)? != 0,
                is_final: row.get::<_, i64>(14)? != 0,
                taken_at: row.get(15)?,
                created_at: row.get(16)?,
            })
        })
    }

    pub fn get_pending_items(&self, period_id: i64) -> Result<Vec<PendingItem>> {
        let conn = self.get_conn();
        let mut items = Vec::new();

        let mut stmt = conn.prepare(
            "SELECT id, period_id, original_path, original_file_name, base64_data, width, height,
                    taken_at, is_final, source_type
             FROM thumbnails
             WHERE period_id = ?1 AND is_selected = 1
             ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(params![period_id], |row| {
            let source_type: String = row.get(9)?;
            let item_type = match source_type.as_str() {
                "collage" => "collage".to_string(),
                "video_frame" => "video_frame".to_string(),
                _ => "photo".to_string(),
            };
            Ok(PendingItem {
                item_type,
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: Some(row.get::<_, String>(2)?),
                file_name: Some(row.get(3)?),
                thumbnail_path: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                time_seconds: None,
                taken_at: row.get(7)?,
                is_final: row.get::<_, i64>(8)? != 0,
                source: Some(source_type),
            })
        })?;
        for row in rows {
            items.push(row?);
        }

        Ok(items)
    }

    pub fn delete_from_pending(&self, item_type: &str, item_id: i64) -> Result<Option<(String, Option<String>)>> {
        let conn = self.get_conn();
        match item_type {
            "photo" => {
                conn.execute(
                    "UPDATE thumbnails SET is_selected = 0 WHERE id = ?1 AND source_type = 'scan'",
                    params![item_id],
                )?;
                Ok(None)
            }
            "collage" => {
                let paths: (String, Option<String>) = conn.query_row(
                    "SELECT original_path, base64_data FROM thumbnails WHERE id = ?1 AND source_type = 'collage'",
                    params![item_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )?;
                conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![item_id])?;
                Ok(Some(paths))
            }
            "video_frame" => {
                let paths: (String, Option<String>) = conn.query_row(
                    "SELECT original_path, base64_data FROM thumbnails WHERE id = ?1 AND source_type = 'video_frame'",
                    params![item_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )?;
                conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![item_id])?;
                Ok(Some(paths))
            }
            _ => Err(rusqlite::Error::InvalidParameterName("unknown item_type".to_string())),
        }
    }

    pub fn insert_video_frame_temp(&self, video_id: i64, period_id: i64, time_seconds: f64, temp_thumb_path: &str) -> Result<VideoFrameTemp> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO video_frame_temp (video_id, period_id, time_seconds, temp_thumb_path, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![video_id, period_id, time_seconds, temp_thumb_path, &now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(VideoFrameTemp {
            id,
            video_id,
            period_id,
            time_seconds,
            temp_thumb_path: temp_thumb_path.to_string(),
            created_at: now,
        })
    }

    pub fn get_temp_frames(&self, video_id: i64) -> Result<Vec<VideoFrameTemp>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT id, video_id, period_id, time_seconds, temp_thumb_path, created_at
             FROM video_frame_temp WHERE video_id = ?1 ORDER BY time_seconds ASC"
        )?;
        let frames = stmt.query_map(params![video_id], |row| {
            Ok(VideoFrameTemp {
                id: row.get(0)?,
                video_id: row.get(1)?,
                period_id: row.get(2)?,
                time_seconds: row.get(3)?,
                temp_thumb_path: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        frames.collect()
    }

    pub fn get_temp_frame_by_id(&self, temp_id: i64) -> Result<VideoFrameTemp> {
        let conn = self.get_conn();
        conn.query_row(
            "SELECT id, video_id, period_id, time_seconds, temp_thumb_path, created_at
             FROM video_frame_temp WHERE id = ?1",
            params![temp_id],
            |row| Ok(VideoFrameTemp {
                id: row.get(0)?,
                video_id: row.get(1)?,
                period_id: row.get(2)?,
                time_seconds: row.get(3)?,
                temp_thumb_path: row.get(4)?,
                created_at: row.get(5)?,
            }),
        )
    }

    pub fn delete_temp_frame(&self, temp_id: i64) -> Result<Option<String>> {
        let conn = self.get_conn();
        let thumb_path: String = conn.query_row(
            "SELECT temp_thumb_path FROM video_frame_temp WHERE id = ?1",
            params![temp_id],
            |row| row.get(0),
        )?;
        conn.execute("DELETE FROM video_frame_temp WHERE id = ?1", params![temp_id])?;
        Ok(Some(thumb_path))
    }

    pub fn delete_all_temp_frames(&self, video_id: i64) -> Result<Vec<String>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare("SELECT temp_thumb_path FROM video_frame_temp WHERE video_id = ?1")?;
        let paths: Vec<String> = stmt.query_map(params![video_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        conn.execute("DELETE FROM video_frame_temp WHERE video_id = ?1", params![video_id])?;
        Ok(paths)
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

    pub fn delete_period_videos(&self, period_id: i64) -> Result<()> {
        let conn = self.get_conn();
        conn.execute("DELETE FROM videos WHERE period_id = ?1", params![period_id])?;
        Ok(())
    }

    // 批量插入视频（事务）
    pub fn add_videos(&self, videos: &[NewVideo]) -> Result<Vec<Video>> {
        let conn = self.get_conn();
        let now = Self::now();
        let mut result = Vec::with_capacity(videos.len());

        // 开启事务，批量插入性能提升 10-100 倍
        conn.execute("BEGIN TRANSACTION", params![])?;

        for video in videos {
            match conn.execute(
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
            ) {
                Ok(_) => {
                    let id = conn.last_insert_rowid();
                    match self.get_video_by_id(id) {
                        Ok(video) => result.push(video),
                        Err(e) => {
                            conn.execute("ROLLBACK", params![]).ok();
                            return Err(e);
                        }
                    }
                }
                Err(e) => {
                    // 出错回滚，记录具体哪个 period_id 导致外键失败
                    eprintln!("批量插入视频失败, period_id={}, file={}: {}", video.period_id, video.file_name, e);
                    conn.execute("ROLLBACK", params![]).ok();
                    return Err(e);
                }
            }
        }

        conn.execute("COMMIT", params![])?;
        Ok(result)
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

    // ==================== 设置操作 ====================

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.get_conn();
        let now = Self::now();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, &now],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map = std::collections::HashMap::new();
        for row in rows {
            let (k, v) = row?;
            map.insert(k, v);
        }
        Ok(map)
    }

    pub fn get_ai_settings(&self) -> Result<AiSettings> {
        let all = self.get_all_settings()?;
        Ok(AiSettings {
            provider: all.get("ai_provider").cloned().unwrap_or_else(|| "siliconflow".into()),
            api_endpoint: all.get("ai_api_endpoint").cloned().unwrap_or_else(|| "https://api.siliconflow.cn/v1/images/generations".into()),
            api_key: all.get("ai_api_key").cloned().unwrap_or_default(),
            model: all.get("ai_model").cloned().unwrap_or_else(|| "black-forest-labs/FLUX.1-schnell".into()),
            enabled: all.get("ai_enabled").map(|v| v == "true").unwrap_or(false),
            style_preset: all.get("ai_style_preset").cloned().unwrap_or_else(|| "warm_glow".into()),
            custom_prompt: all.get("ai_custom_prompt").cloned().unwrap_or_default(),
            frame_duration: all.get("ai_frame_duration").and_then(|v| v.parse().ok()).unwrap_or(1.5),
        })
    }
}

// ==================== AI 设置结构体 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSettings {
    pub provider: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub model: String,
    pub enabled: bool,
    pub style_preset: String,
    pub custom_prompt: String,
    pub frame_duration: f64,
}

// ==================== 辅助结构体 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingItem {
    pub item_type: String,
    pub id: i64,
    pub period_id: i64,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub thumbnail_path: Option<String>,
    pub width: i64,
    pub height: i64,
    pub time_seconds: Option<f64>,
    pub taken_at: Option<String>,
    pub is_final: bool,
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
