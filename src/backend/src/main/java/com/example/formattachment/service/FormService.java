package com.example.formattachment.service;

import com.example.formattachment.model.AttachmentDto;
import com.example.formattachment.model.AttachmentGroupDto;
import com.example.formattachment.model.FormDetailDto;
import com.example.formattachment.model.FormRowDto;
import com.example.formattachment.model.FormSummaryDto;
import com.example.formattachment.model.FormTabDto;
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
                create table if not exists form_tabs (
                    id text primary key,
                    form_id text not null,
                    name text not null,
                    tab_order integer not null,
                    foreign key(form_id) references forms(id)
                )
                """);
        jdbcTemplate.execute("""
                create table if not exists form_rows (
                    id text primary key,
                    form_id text not null,
                    tab_id text,
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
                    foreign key(form_id) references forms(id),
                    foreign key(tab_id) references form_tabs(id)
                )
                """);
        ensureColumn("form_rows", "tab_id", "alter table form_rows add column tab_id text");
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
        backfillTabsForExistingForms();
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

        List<FormTabDto> emptyTabs = jdbcTemplate.query(
                "select id, name from form_tabs where form_id = ? order by tab_order",
                (rs, rowNum) -> new FormTabDto(rs.getString("id"), rs.getString("name"), List.of()),
                formId
        );

        List<FormRowDto> rows = findRows(formId);
        Map<String, List<FormRowDto>> rowsByTab = rows.stream()
                .collect(Collectors.groupingBy(FormRowDto::tabId));

        List<FormTabDto> tabs = emptyTabs.stream()
                .map(tab -> new FormTabDto(tab.id(), tab.name(), rowsByTab.getOrDefault(tab.id(), List.of())))
                .toList();

        return new FormDetailDto(summary.id(), summary.formNo(), summary.latestUpdater(), summary.updatedAt(), tabs);
    }

    @Transactional
    public FormDetailDto saveForm(String formId, SaveFormRequest request, List<MultipartFile> files) throws IOException {
        Iterator<MultipartFile> pendingFiles = files.iterator();
        String now = OffsetDateTime.now().toString();

        List<Long> deletedAttachmentIds = request.deletedAttachmentIds() == null ? List.of() : request.deletedAttachmentIds();
        for (Long attachmentId : deletedAttachmentIds) {
            deleteAttachment(attachmentId);
        }

        List<FormTabDto> tabs = request.tabs() == null ? List.of() : request.tabs();
        for (int tabIndex = 0; tabIndex < tabs.size(); tabIndex++) {
            FormTabDto tab = tabs.get(tabIndex);
            jdbcTemplate.update("update form_tabs set name = ?, tab_order = ? where id = ? and form_id = ?",
                    tab.name(), tabIndex, tab.id(), formId);

            for (int rowIndex = 0; rowIndex < tab.rows().size(); rowIndex++) {
                FormRowDto row = tab.rows().get(rowIndex);
                if (isPendingCreate(row)) {
                    insertRow(formId, tab.id(), row, rowIndex);
                } else {
                    updateRow(formId, tab.id(), row, rowIndex);
                }
            }
        }

        List<AttachmentDto> pendingUploads = request.pendingUploads() == null ? List.of() : request.pendingUploads();
        for (AttachmentDto attachment : pendingUploads) {
            if (!"pendingUpload".equals(attachment.status())) {
                continue;
            }
            if (!pendingFiles.hasNext()) {
                throw new IllegalArgumentException("附件 payload 與檔案數量不一致");
            }
            MultipartFile file = pendingFiles.next();
            String attachmentId = attachment.attachmentId();
            if (attachmentId == null || attachmentId.isBlank()) {
                throw new IllegalArgumentException("attachmentId 不可為空");
            }
            String rowId = findRowIdByAttachmentId(formId, attachmentId);
            saveAttachmentFile(rowId, attachmentId, file, now);
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

    public AttachmentGroupDto createAttachmentGroup() {
        return new AttachmentGroupDto("att-" + UUID.randomUUID());
    }

    public List<AttachmentDto> listAttachments(String attachmentId) {
        return jdbcTemplate.query(
                "select * from attachments where att_id = ? order by uploaded_at",
                (rs, rowNum) -> new AttachmentDto(
                        rs.getLong("id"),
                        null,
                        rs.getString("att_id"),
                        rs.getString("file_name"),
                        rs.getLong("size"),
                        rs.getString("content_type"),
                        rs.getString("uploaded_at"),
                        rs.getString("uploader"),
                        "persisted"
                ),
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
                for (int tabIndex = 1; tabIndex <= 3; tabIndex++) {
                    String tabId = formId + "-tab-" + tabIndex;
                    if (rowIndex == 1) {
                        jdbcTemplate.update(
                                "insert into form_tabs(id, form_id, name, tab_order) values (?, ?, ?, ?)",
                                tabId,
                                formId,
                                "分頁" + tabIndex,
                                tabIndex
                        );
                    }
                    jdbcTemplate.update("""
                            insert into form_rows(id, form_id, tab_id, att_id, field1, field2, field3, field4, field5,
                            field6, field7, field8, field9, field10, row_order)
                            values (?, ?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            formId + "-tab-" + tabIndex + "-row-" + rowIndex,
                            formId,
                            tabId,
                            "資料 " + tabIndex + "-" + rowIndex + "-1",
                            "資料 " + tabIndex + "-" + rowIndex + "-2",
                            "資料 " + tabIndex + "-" + rowIndex + "-3",
                            "資料 " + tabIndex + "-" + rowIndex + "-4",
                            "資料 " + tabIndex + "-" + rowIndex + "-5",
                            "資料 " + tabIndex + "-" + rowIndex + "-6",
                            "資料 " + tabIndex + "-" + rowIndex + "-7",
                            "資料 " + tabIndex + "-" + rowIndex + "-8",
                            "資料 " + tabIndex + "-" + rowIndex + "-9",
                            "資料 " + tabIndex + "-" + rowIndex + "-10",
                            rowIndex
                    );
                }
            }
        }
    }

    private List<FormRowDto> findRows(String formId) {
        return jdbcTemplate.query(
                "select * from form_rows where form_id = ? order by tab_id, row_order",
                (rs, rowNum) -> new FormRowDto(
                        rs.getString("id"),
                        rs.getString("tab_id"),
                        "persisted",
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
                        rs.getString("field10")
                ),
                formId
        );
    }

    private boolean isPendingCreate(FormRowDto row) {
        return "pendingCreate".equals(row.status()) || row.id().startsWith("tmp-row-");
    }

    private void insertRow(String formId, String tabId, FormRowDto row, int rowOrder) {
        String rowId = tabId + "-row-" + UUID.randomUUID();
        jdbcTemplate.update("""
                insert into form_rows(id, form_id, tab_id, att_id, field1, field2, field3, field4, field5,
                field6, field7, field8, field9, field10, row_order)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rowId,
                formId,
                tabId,
                row.attachmentId(),
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
                rowOrder
        );
    }

    private void updateRow(String formId, String tabId, FormRowDto row, int rowOrder) {
        jdbcTemplate.update("""
                update form_rows
                set tab_id = ?, att_id = ?, field1 = ?, field2 = ?, field3 = ?, field4 = ?, field5 = ?,
                    field6 = ?, field7 = ?, field8 = ?, field9 = ?, field10 = ?, row_order = ?
                where id = ? and form_id = ?
                """,
                tabId,
                row.attachmentId(),
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
                rowOrder,
                row.id(),
                formId
        );
    }

    private void ensureColumn(String tableName, String columnName, String alterSql) {
        Boolean exists = jdbcTemplate.query(
                "pragma table_info(" + tableName + ")",
                rs -> {
                    while (rs.next()) {
                        if (columnName.equals(rs.getString("name"))) {
                            return true;
                        }
                    }
                    return false;
                }
        );
        if (!Boolean.TRUE.equals(exists)) {
            jdbcTemplate.execute(alterSql);
        }
    }

    private void backfillTabsForExistingForms() {
        List<FormSummaryDto> forms = listForms();
        for (FormSummaryDto form : forms) {
            for (int tabIndex = 1; tabIndex <= 3; tabIndex++) {
                String tabId = form.id() + "-tab-" + tabIndex;
                jdbcTemplate.update(
                        "insert or ignore into form_tabs(id, form_id, name, tab_order) values (?, ?, ?, ?)",
                        tabId,
                        form.id(),
                        "分頁" + tabIndex,
                        tabIndex
                );
                ensureTestRows(form.id(), tabId, tabIndex);
            }
            jdbcTemplate.update(
                    "update form_rows set tab_id = ? where form_id = ? and tab_id is null",
                    form.id() + "-tab-1",
                    form.id()
            );
        }
    }

    private void ensureTestRows(String formId, String tabId, int tabIndex) {
        Integer rowCount = jdbcTemplate.queryForObject(
                "select count(*) from form_rows where form_id = ? and tab_id = ?",
                Integer.class,
                formId,
                tabId
        );
        if (rowCount != null && rowCount > 0) {
            return;
        }

        for (int rowIndex = 1; rowIndex <= 8; rowIndex++) {
            jdbcTemplate.update("""
                    insert or ignore into form_rows(id, form_id, tab_id, att_id, field1, field2, field3, field4, field5,
                    field6, field7, field8, field9, field10, row_order)
                    values (?, ?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    formId + "-tab-" + tabIndex + "-row-" + rowIndex,
                    formId,
                    tabId,
                    "資料 " + tabIndex + "-" + rowIndex + "-1",
                    "資料 " + tabIndex + "-" + rowIndex + "-2",
                    "資料 " + tabIndex + "-" + rowIndex + "-3",
                    "資料 " + tabIndex + "-" + rowIndex + "-4",
                    "資料 " + tabIndex + "-" + rowIndex + "-5",
                    "資料 " + tabIndex + "-" + rowIndex + "-6",
                    "資料 " + tabIndex + "-" + rowIndex + "-7",
                    "資料 " + tabIndex + "-" + rowIndex + "-8",
                    "資料 " + tabIndex + "-" + rowIndex + "-9",
                    "資料 " + tabIndex + "-" + rowIndex + "-10",
                    rowIndex
            );
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

    private String findRowIdByAttachmentId(String formId, String attachmentId) {
        return jdbcTemplate.queryForObject(
                "select id from form_rows where form_id = ? and att_id = ? limit 1",
                String.class,
                formId,
                attachmentId
        );
    }

    private void deleteAttachment(Long attachmentId) throws IOException {
        AttachmentResource resource = getAttachment(attachmentId);
        Files.deleteIfExists(resource.path());
        jdbcTemplate.update("delete from attachments where id = ?", attachmentId);
    }

    public record AttachmentResource(Path path, String fileName, String contentType) {
    }

}
