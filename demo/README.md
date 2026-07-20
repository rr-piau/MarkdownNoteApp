# demo

このプロジェクトは Gradle から Maven に移行しました。以下は Maven を使ったビルドと実行手順です。

## ビルド (Maven Wrapper)

プロジェクトルートで次を実行します:

```powershell
cd demo
.\mvnw.cmd -U package
```

生成されたアーティファクトは `target/` に配置されます（例: `target/demo-0.0.1-SNAPSHOT.jar`）。

## 実行

```powershell
cd demo
.\mvnw.cmd spring-boot:run
```

もしくは生成された JAR を直接実行:

```powershell
java -jar target/demo-0.0.1-SNAPSHOT.jar
```

## Gradle の残骸を削除する（必要な場合）

プロジェクトルートに `gradlew` や `gradlew.bat`、`gradle/wrapper/` が残っている場合は削除して問題ありません。また、ローカルの Gradle キャッシュ `.gradle/` は削除しても安全です:

```powershell
Remove-Item -LiteralPath gradlew, gradlew.bat -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\gradle\wrapper -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .gradle -Recurse -Force -ErrorAction SilentlyContinue
```

## JAVA_HOME

ビルドや `mvnw` 実行時に `JAVA_HOME` を要求されることがあります。Windows で恒久的に設定するには:

1. システム環境変数で `JAVA_HOME` を `C:\Program Files\Java\jdk-XX` のように追加。
2. `Path` に `%JAVA_HOME%\bin` を追加。

---

必要なら私のほうで `gradlew` 等のファイルを削除したり、`README.md` を日本語でさらに整備します。ご希望を教えてください。
