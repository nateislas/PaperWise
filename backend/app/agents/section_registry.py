from typing import Dict, List, Any


# Config-driven registry of sections per detected field
# Each section spec is a lightweight dict consumed by a generic extractor

FIELD_TO_SECTION_SPECS: Dict[str, List[Dict[str, Any]]] = {
    "ml_dl": [
        {
            "key": "model_architecture",
            "title": "Model Architecture",
            "cues": [
                "architecture",
                "transformer",
                "cnn",
                "attention",
                "encoder",
                "decoder",
                "layer",
                "parameter",
                "figure",
                "diagram",
            ],
            "schema": {
                "name": "string",
                "high_level_type": "string",
                "modules": "array(object)",
                "parameters_millions": "number|null",
                "diagram_refs": "array(string)",
                "key_novelty": "string",
            },
            "guidance": (
                "Summarize the architecture succinctly using only information grounded in the paper. "
                "Prefer citing figure numbers or section headings if available."
            ),
        },
        {
            "key": "training_setup",
            "title": "Training Setup",
            "cues": ["training", "optimizer", "loss", "epochs", "batch size", "learning rate"],
            "schema": {
                "datasets": "array(string)",
                "objective": "string",
                "optimizer": "string",
                "hyperparameters": "object",
                "compute": "string",
            },
            "guidance": "Capture concrete settings; if unknown, set fields to empty/neutral values.",
        },
        {
            "key": "results",
            "title": "Results",
            "cues": ["results", "evaluation", "benchmark", "accuracy", "AUROC", "BLEU", "F1"],
            "schema": {"highlights": "array(string)", "tables_or_figures": "array(string)"},
            "guidance": "Extract key quantitative results and referenced tables or figures.",
        },
    ],
    "generic": [
        {
            "key": "problem",
            "title": "Problem",
            "cues": ["introduction", "problem", "motivation", "goal"],
            "schema": {"summary": "string"},
            "guidance": "One-paragraph summary of the research problem and motivation.",
        },
        {
            "key": "method",
            "title": "Method",
            "cues": ["method", "approach", "proposed", "technique"],
            "schema": {"summary": "string"},
            "guidance": "Summarize the core method succinctly.",
        },
        {
            "key": "findings",
            "title": "Key Findings",
            "cues": ["results", "findings", "conclusion"],
            "schema": {"bullets": "array(string)"},
            "guidance": "3-5 bullet points with strongest empirical or theoretical findings.",
        },
    ],
}


