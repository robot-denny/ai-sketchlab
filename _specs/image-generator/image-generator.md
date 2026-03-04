# Spec for <feature-name>

branch: claude/feature/<feature-name>
figma_component (if used): <figma-component>

## Summary
A system that generates unique abstract featured images for blog posts using the article's own metadata as creative input. Each image is reproducible, visually distinct, and tied directly to the content it represents—without relying on text prompts or generic AI image generation.

## Problem Statement
The demo site needs featured images for articles and author profiles, but we want to avoid:
- Generic stock photography
- Prompt-based AI art that looks like "AI art"
- Manual image creation for every piece of content
- Images that feel disconnected from their articles

## Input (Article Metadata):
- Node ID → Seeds particle spawn positions
- Title → Seeds the flow field pattern (via hash)
- Word Count → Determines density/complexity (more words = more particles, longer trails)
- Categories → Determines color palette (AI/ML = cyan, Ethics = orange, Sustainability = green, Vibe Coding = purple)

## Process:
- Generate a Perlin noise-based flow field (invisible force field of directional vectors)
- Spawn particles at positions determined by node ID
- Particles flow through the field following the vector directions
- Trail paths are rendered with category-specific colors
- Result: organic, flowing abstract patterns unique to that article

**reference @flow_field_generator.py file for an example when planning implementation**

## Output:
- 1200x630px images (optimized for social sharing)
- Dark background with colored flow lines
- Each article produces the same image every time (reproducible)
- Different articles produce visibly different patterns

## Functional Requirements
- An command is created that generates an image based on Input (Article Metadata)
- The image is uploaded to media library via MCP
- The image is to a specific piece of content as the "main image" via MCP
- Image size is 1200x630px images (optimized for social sharing)
- Image style is Dark background with colored flow lines
- Each article produces the same image every time (reproducible)
- Different articles produce visibly different patterns

## Possible Edge Cases
- ...

## Acceptance Criteria
- ...

## Open Questions
- ...

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy: 
- ...