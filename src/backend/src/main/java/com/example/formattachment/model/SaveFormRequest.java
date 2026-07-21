package com.example.formattachment.model;

import java.util.List;

public record SaveFormRequest(
        String id,
        List<FormTabDto> tabs,
        List<AttachmentDto> pendingUploads,
        List<Long> deletedAttachmentIds
) {
}
