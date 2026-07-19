package com.example.formattachment.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class StaticForwardController {
    @GetMapping(value = {"/", "/forms/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
