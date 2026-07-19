package com.example.formattachment.controller;

import com.example.formattachment.model.FormDetailDto;
import com.example.formattachment.model.FormSummaryDto;
import com.example.formattachment.model.SaveFormRequest;
import com.example.formattachment.service.FormService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
public class FormController {
    private final FormService formService;
    private final ObjectMapper objectMapper;

    public FormController(FormService formService, ObjectMapper objectMapper) {
        this.formService = formService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/forms")
    public List<FormSummaryDto> listForms() {
        return formService.listForms();
    }

    @GetMapping("/api/forms/{formId}")
    public FormDetailDto getForm(@PathVariable String formId) {
        return formService.getForm(formId);
    }

    @PostMapping(value = "/api/forms/{formId}/save", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FormDetailDto saveForm(
            @PathVariable String formId,
            @RequestPart("payload") String payload,
            @RequestPart(value = "files", required = false) List<MultipartFile> files
    ) throws IOException {
        SaveFormRequest request = objectMapper.readValue(payload, SaveFormRequest.class);
        return formService.saveForm(formId, request, files == null ? List.of() : files);
    }

    @PostMapping("/api/dev/seed")
    public void seed() {
        formService.seed();
    }
}
