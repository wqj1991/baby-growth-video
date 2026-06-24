fn main() {
    println!("cargo:warning=Starting build script");
    let result = tauri_build::build();
    println!("cargo:warning=Build script result: {:?}", result);
}