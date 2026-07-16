package com.myapp.noteapp;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

@SpringBootApplication
@Controller
public class NA01Controller {

    private static final Path SAVE_PATH = Paths.get("saved-markdown.md");
    private static final String DEFAULT_MARKDOWN = "# タイトル\n\n- 箇条書き\n- 例\n\n**強調** など";

    public static void main(String[] args) {
        SpringApplication.run(NA01Controller.class, args);
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("initialMarkdown", loadMarkdown());
        return "NA01";
    }

    @PostMapping(path = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, String>> save(@RequestBody SaveRequest request) {
        saveMarkdown(request.getMarkdown());
        return ResponseEntity.ok(Map.of("message", "保存しました"));
    }

    private static String loadMarkdown() {
        try {
            if (Files.exists(SAVE_PATH)) {
                return Files.readString(SAVE_PATH, StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            // 読み込み失敗時はデフォルトを返します
        }
        return DEFAULT_MARKDOWN;
    }

    private static void saveMarkdown(String markdown) {
        try {
            Path parent = SAVE_PATH.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(SAVE_PATH, markdown, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            throw new RuntimeException("Markdownを保存できませんでした", e);
        }
    }

    public static class SaveRequest {
        private String markdown;

        public String getMarkdown() {
            return markdown;
        }

        public void setMarkdown(String markdown) {
            this.markdown = markdown;
        }
    }
}
