package com.example.formattachment.service;

import com.example.formattachment.model.AttachmentDto;
import com.example.formattachment.model.FormDetailDto;
import com.example.formattachment.model.FormRowDto;
import com.example.formattachment.model.FormSummaryDto;
import com.example.formattachment.model.SaveFormRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FormService {
    private static final String CURRENT_USER = "test-user";

    private final JdbcTemplate jdbcTemplate;
    private final Path attachmentsRoot;

    public FormService(JdbcTemplate jdbcTemplate, @Value("${app.attachments-root}") String attachmentsRoot) {
        this.jdbcTemplate = jdbcTemplate;
        this.attachmentsRoot = Path.of(attachmentsRoot).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void initialize() throws IOException {
        Files.createDirectories(attachmentsRoot);
        jdbcTemplate.execute("""
                create table if not exists forms (
                    id text primary key,
                    form_no text not null,
                    latest_updater text not null,
                    updated_at text not null
                )
                """);
        jdbcTemplate.execute("""
                create table if not exists form_rows (
                    id text primary key,
                    form_id text not null,
                    att_id text,
                    field1 text not null,
                    field2 text not null,
                    field3 text not null,
                    field4 text not null,
                    field5 text not null,
                    field6 text not null,
                    field7 text not null,
                    field8 text not null,
                    field9 text not null,
                    field10 text not null,
                    row_order integer not null,
                    foreign key(form_id) references forms(id)
                )
                """);
        jdbcTemplate.execute("""
                create table if not exists attachments (
                    id integer primary key autoincrement,
                    row_id text not null,
                    att_id text not null,
                    file_name text not null,
                    stored_name text not null,
                    size integer not null,
                    content_type text not null,
                    uploaded_at text not null,
                    uploader text not null,
                    foreign key(row_id) references form_rows(id)
                )
                """);
    }

    public List<FormSummaryDto> listForms() {
        return jdbcTemplate.query(
                "select id, form_no, latest_updater, updated_at from forms order by updated_at desc",
                (rs, rowNum) -> new FormSummaryDto(
                        rs.getString("id"),
                        rs.getString("form_no"),
                        rs.getString("latest_updater"),
                        rs.getString("updated_at")
                )
        );
    }

    public FormDetailDto getForm(String formId) {
        FormSummaryDto summary = jdbcTemplate.queryForObject(
                "select id, form_no, latest_updater, updated_at from forms where id = ?",
                (rs, rowNum) -> new FormSummaryDto(
                        rs.getString("id"),
                        rs.getString("form_no"),
                        rs.getString("latest_updater"),
                        rs.getString("updated_at")
                ),
                formId
        );
        if (summary == null) {
            throw new IllegalArgumentException("找不到表單");
        }

        List<FormRowDto> rows = jdbcTemplate.query(
                "select * from form_rows where form_id = ? order by row_order",
                (rs, rowNum) -> new FormRowDto(
                        rs.getString("id"),
                        rs.getString("att_id"),
                        rs.getString("field1"),
                        rs.getString("field2"),
                        rs.getString("field3"),
                        rs.getString("field4"),
                        rs.getString("field5"),
                        rs.getString("field6"),
                        rs.getString("field7"),
                        rs.getString("field8"),
                        rs.getString("field9"),
                        rs.getString("field10"),
                        new ArrayList<>()
                ),
                formId
        );

        Map<String, List<AttachmentDto>> attachmentsByRow = rows.isEmpty()
                ? Map.of()
                : jdbcTemplate.query(
                        "select * from attachments where row_id in (%s) order by uploaded_at"
                                .formatted(rows.stream().map(row -> "?").collect(Collectors.joining(","))),
                        (rs, rowNum) -> new AttachmentRow(
                                rs.getString("row_id"),
                                new AttachmentDto(
                                        rs.getLong("id"),
                                        null,
                                        rs.getString("att_id"),
                                        rs.getString("file_name"),
                                        rs.getLong("size"),
                                        rs.getString("content_type"),
                                        rs.getString("uploaded_at"),
                                        rs.getString("uploader"),
                                        "persisted"
                                )
                        ),
                        rows.stream().map(FormRowDto::id).toArray()
                ).stream().collect(Collectors.groupingBy(
                        AttachmentRow::rowId,
                        Collectors.mapping(AttachmentRow::attachment, Collectors.toList())
                ));

        List<FormRowDto> mergedRows = rows.stream()
                .map(row -> new FormRowDto(
                        row.id(),
                        row.attId(),
                        row.field1(),
                        row.field2(),
                        row.field3(),
                        row.field4(),
                        row.field5(),
                        row.field6(),
                        row.field7(),
                        row.field8(),
                        row.field9(),
                        row.field10(),
                        attachmentsByRow.getOrDefault(row.id(), List.of())
                ))
                .toList();

        return new FormDetailDto(summary.id(), summary.formNo(), summary.latestUpdater(), summary.updatedAt(), mergedRows);
    }

    @Transactional
    public FormDetailDto saveForm(String formId, SaveFormRequest request, List<MultipartFile> files) throws IOException {
        Iterator<MultipartFile> pendingFiles = files.iterator();
        String now = OffsetDateTime.now().toString();

        List<Long> deletedAttachmentIds = request.deletedAttachmentIds() == null ? List.of() : request.deletedAttachmentIds();
        for (Long attachmentId : deletedAttachmentIds) {
            deleteAttachment(attachmentId);
        }

        for (int i = 0; i < request.rows().size(); i++) {
            FormRowDto row = request.rows().get(i);
            jdbcTemplate.update("""
                    update form_rows
                    set att_id = ?, field1 = ?, field2 = ?, field3 = ?, field4 = ?, field5 = ?,
                        field6 = ?, field7 = ?, field8 = ?, field9 = ?, field10 = ?, row_order = ?
                    where id = ? and form_id = ?
                    """,
                    row.attId(),
                    row.field1(),
                    row.field2(),
                    row.field3(),
                    row.field4(),
                    row.field5(),
                    row.field6(),
                    row.field7(),
                    row.field8(),
                    row.field9(),
                    row.field10(),
                    i,
                    row.id(),
                    formId
            );

            for (AttachmentDto attachment : row.attachments()) {
                if (!"pendingUpload".equals(attachment.status())) {
                    continue;
                }
                if (!pendingFiles.hasNext()) {
                    throw new IllegalArgumentException("附件 payload 與檔案數量不一致");
                }
                MultipartFile file = pendingFiles.next();
                String attId = attachment.attId() == null || attachment.attId().isBlank()
                        ? "att-" + UUID.randomUUID()
                        : attachment.attId();
                saveAttachmentFile(row.id(), attId, file, now);
            }
        }

        jdbcTemplate.update("update forms set latest_updater = ?, updated_at = ? where id = ?", CURRENT_USER, now, formId);
        return getForm(formId);
    }

    public AttachmentResource getAttachment(Long attachmentId) {
        return jdbcTemplate.queryForObject(
                "select * from attachments where id = ?",
                (rs, rowNum) -> {
                    Path path = attachmentsRoot.resolve(rs.getString("att_id")).resolve(rs.getString("stored_name")).normalize();
                    if (!path.startsWith(attachmentsRoot)) {
                        throw new IllegalStateException("附件路徑不合法");
                    }
                    return new AttachmentResource(
                            path,
                            rs.getString("file_name"),
                            rs.getString("content_type")
                    );
                },
                attachmentId
        );
    }

    @Transactional
    public void seed() {
        if (!listForms().isEmpty()) {
            return;
        }
        String now = OffsetDateTime.now().toString();
        for (int formIndex = 1; formIndex <= 3; formIndex++) {
            String formId = "form-" + formIndex;
            jdbcTemplate.update(
                    "insert into forms(id, form_no, latest_updater, updated_at) values (?, ?, ?, ?)",
                    formId,
                    "F-2026-000" + formIndex,
                    CURRENT_USER,
                    now
            );
            for (int rowIndex = 1; rowIndex <= 8; rowIndex++) {
                jdbcTemplate.update("""
                        insert into form_rows(id, form_id, att_id, field1, field2, field3, field4, field5,
                        field6, field7, field8, field9, field10, row_order)
                        values (?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        formId + "-row-" + rowIndex,
                        formId,
                        "資料 " + rowIndex + "-1",
                        "資料 " + rowIndex + "-2",
                        "資料 " + rowIndex + "-3",
                        "資料 " + rowIndex + "-4",
                        "資料 " + rowIndex + "-5",
                        "資料 " + rowIndex + "-6",
                        "資料 " + rowIndex + "-7",
                        "資料 " + rowIndex + "-8",
                        "資料 " + rowIndex + "-9",
                        "資料 " + rowIndex + "-10",
                        rowIndex
                );
            }
        }
    }

    private void saveAttachmentFile(String rowId, String attId, MultipartFile file, String now) throws IOException {
        Path targetDirectory = attachmentsRoot.resolve(attId).normalize();
        if (!targetDirectory.startsWith(attachmentsRoot)) {
            throw new IllegalArgumentException("attId 不合法");
        }
        Files.createDirectories(targetDirectory);

        String originalName = Path.of(file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename())
                .getFileName()
                .toString();
        String storedName = UUID.randomUUID() + "-" + originalName;
        Files.copy(file.getInputStream(), targetDirectory.resolve(storedName), StandardCopyOption.REPLACE_EXISTING);

        jdbcTemplate.update("""
                insert into attachments(row_id, att_id, file_name, stored_name, size, content_type, uploaded_at, uploader)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rowId,
                attId,
                originalName,
                storedName,
                file.getSize(),
                file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
                now,
                CURRENT_USER
        );
    }

    private void deleteAttachment(Long attachmentId) throws IOException {
        AttachmentResource resource = getAttachment(attachmentId);
        Files.deleteIfExists(resource.path());
        jdbcTemplate.update("delete from attachments where id = ?", attachmentId);
    }

    public record AttachmentResource(Path path, String fileName, String contentType) {
    }

    private record AttachmentRow(String rowId, AttachmentDto attachment) {
    }
}
