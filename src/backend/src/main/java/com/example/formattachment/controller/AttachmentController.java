package com.example.formattachment.controller;

import com.example.formattachment.model.AttachmentDto;
import com.example.formattachment.model.AttachmentGroupDto;
import com.example.formattachment.service.FormService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AttachmentController {
    private final FormService formService;

    public AttachmentController(FormService formService) {
        this.formService = formService;
    }

    @PostMapping("/api/attachment-groups")
    public AttachmentGroupDto createAttachmentGroup() {
        return formService.createAttachmentGroup();
    }

    @GetMapping("/api/attachment-groups/{attachmentId}/attachments")
    public List<AttachmentDto> listAttachments(@PathVariable String attachmentId) {
        return formService.listAttachments(attachmentId);
    }

    @GetMapping("/api/attachments/{attachmentId}/download")
    public ResponseEntity<FileSystemResource> download(@PathVariable Long attachmentId) {
        FormService.AttachmentResource resource = formService.getAttachment(attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resource.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(resource.fileName())
                        .build()
                        .toString())
                .body(new FileSystemResource(resource.path()));
    }
}
