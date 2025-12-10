# Specification: Preview Mode Annotations

## Metadata
- **ID**: 0049
- **Status**: draft
- **Created**: 2025-12-10
- **Dependencies**: 0048 (Markdown Preview)

## Problem Statement

When reviewing markdown files (specs, plans, documentation) in preview mode (0048), users can see beautifully rendered content but cannot interact with it to leave feedback. To add a REVIEW comment, they must:

1. Switch back to annotate mode
2. Find the corresponding line number
3. Click the line number to add annotation

This breaks the review flow. The rendered preview is where reviewers actually *read* the content, but annotations can only be added in the raw view where content is harder to parse.

## Current State

After 0048, the file viewer has three modes:
1. **Annotate mode** (default): Raw markdown with line numbers, click line to add REVIEW comment
2. **Preview mode**: Rendered markdown, read-only, no interaction
3. **Edit mode**: Textarea for direct editing

Annotations are added by clicking line numbers in annotate mode, which inserts `<!-- REVIEW: comment -->` into the file.

## Desired State

Allow adding REVIEW comments directly from preview mode:

1. User clicks on a rendered element (heading, paragraph, list item, code block, etc.)
2. A comment dialog appears at/near the clicked location
3. User types their comment
4. Comment is inserted into the markdown source at the appropriate location
5. Preview updates to show the new comment (rendered or as visible marker)

## Stakeholders
- **Primary Users**: Architects reviewing specs/plans, anyone reviewing documentation
- **Secondary Users**: Builders reading feedback
- **Technical Team**: Codev maintainers

## Success Criteria
- [ ] Clicking on a rendered element in preview mode opens annotation dialog
- [ ] Annotation is inserted at correct location in markdown source
- [ ] Preview updates after annotation is added
- [ ] Works for headings, paragraphs, list items, code blocks, blockquotes
- [ ] Clear visual feedback showing which element will receive the annotation
- [ ] Escape key or click-outside cancels annotation
- [ ] Existing annotate-mode workflow unchanged

## Constraints

### Technical Constraints
- Must track line numbers through marked.js rendering pipeline
- Markdown elements can span multiple source lines
- Some elements are nested (list item inside list, paragraph inside blockquote)
- Must work with existing REVIEW comment format: `<!-- REVIEW: comment -->`

### Business Constraints
- Should feel natural - similar UX to existing line-number annotations
- Must not break preview rendering performance
- Keep implementation focused - this is an enhancement, not a rewrite

## Assumptions
- marked.js can be configured to add source line metadata to rendered elements
- Users expect comment to be inserted *before* the clicked element (like a margin note)
- Complex nested structures (tables, deeply nested lists) may have degraded UX initially

## Solution Approaches

### Approach 1: Line Tracking via marked.js Renderer (Recommended)

**Description**: Customize marked.js renderer to track source line numbers and add `data-line` attributes to rendered elements.

**Implementation**:
1. Use marked.js `walkTokens` or custom renderer to track line positions
2. Add `data-source-line="N"` attribute to block-level elements
3. Add click handler to preview container
4. On click, find nearest element with `data-source-line`
5. Open annotation dialog positioned near click
6. On submit, insert `<!-- REVIEW(@user): comment -->` before line N in source
7. Re-render preview

**Pros**:
- Precise line tracking
- Works with existing annotation format
- Clear mapping from rendered to source

**Cons**:
- marked.js token positions may not perfectly match source lines
- Need to handle multi-line elements (use first line)

**Estimated Complexity**: Medium
**Risk Level**: Medium

### Approach 2: Text Selection Based

**Description**: Allow selecting text in preview, then annotate based on selected content.

**Implementation**:
1. User selects text in preview
2. "Add Comment" button appears near selection
3. Search for selected text in source to find line number
4. Insert annotation

**Pros**:
- More intuitive for users (select what you're commenting on)
- No line tracking needed in renderer

**Cons**:
- Ambiguous if same text appears multiple times
- Selection can span multiple elements
- Doesn't work well for non-text (code blocks, images)

**Estimated Complexity**: Medium
**Risk Level**: High (ambiguity issues)

### Approach 3: Floating Comment Markers

**Description**: Show clickable comment icons in the margin of preview mode.

**Implementation**:
1. Render preview with line numbers in margin (like annotate mode)
2. Each line number is clickable to add annotation
3. Essentially annotate mode but with rendered content

**Pros**:
- Consistent with existing UX
- No complex line tracking
- Clear which line gets annotation

**Cons**:
- Preview with line numbers looks less clean
- Line numbers don't map well to rendered content (heading on line 5 might render at visual line 2)

**Estimated Complexity**: Low
**Risk Level**: Low

## Selected Approach

**Approach 1: Line Tracking via marked.js Renderer** - provides the cleanest UX while maintaining precise source mapping.

## Open Questions

### Critical (Blocks Progress)
- [ ] Does marked.js expose token positions in a usable way? Need to verify with prototype.

### Important (Affects Design)
- [ ] Where exactly to insert comment - before the line, or at end of previous element?
- [ ] How to handle nested elements (e.g., paragraph inside blockquote)?
- [ ] Should clicking a code block annotate the whole block or specific lines within?

### Nice-to-Know (Optimization)
- [ ] Could we show existing annotations in preview mode as highlighted markers?
- [ ] Should preview auto-scroll to show newly added annotation?

## Technical Design

### Line Tracking

marked.js provides token positions. We can use a custom renderer:

```javascript
const renderer = {
  heading(text, level, raw, slugger) {
    const line = this.parser.tokens[this.parser.tokenIndex]?.line || 0;
    return `<h${level} data-source-line="${line}">${text}</h${level}>`;
  },
  paragraph(text) {
    const line = this.parser.tokens[this.parser.tokenIndex]?.line || 0;
    return `<p data-source-line="${line}">${text}</p>`;
  },
  // ... etc for other block elements
};
```

### Click Handler

```javascript
previewContainer.addEventListener('click', (e) => {
  const element = e.target.closest('[data-source-line]');
  if (!element) return;

  const line = parseInt(element.dataset.sourceLine, 10);
  openAnnotationDialog(line, e.clientX, e.clientY);
});
```

### Annotation Insertion

```javascript
function insertAnnotation(lineNumber, comment) {
  const lines = currentContent.split('\n');
  const annotation = `<!-- REVIEW: ${comment} -->`;
  lines.splice(lineNumber - 1, 0, annotation);
  currentContent = lines.join('\n');
  // Save and re-render
  saveFile();
  renderPreview();
}
```

## Performance Requirements
- Click-to-dialog latency: <100ms
- Annotation insertion + re-render: <500ms
- No perceptible lag in preview rendering with line tracking

## Security Considerations
- Annotation content must be escaped when inserted (prevent markdown injection)
- Dialog input should be sanitized
- Existing DOMPurify sanitization handles rendering

## Test Scenarios

### Functional Tests
1. Click heading in preview -> annotation dialog opens
2. Click paragraph -> dialog at correct position
3. Click list item -> annotates correct line
4. Click code block -> annotates first line of block
5. Submit annotation -> inserted at correct source line
6. Cancel annotation (Escape) -> no changes
7. Click outside dialog -> closes dialog
8. Preview updates after annotation added
9. File saves after annotation added
10. Multiple annotations on same element work correctly

### Edge Cases
1. Click inside nested element (list item in blockquote) -> annotates innermost element
2. Very long paragraph -> dialog positioned reasonably
3. Element at top of file -> annotation inserted at line 1
4. Element at bottom of file -> annotation inserted correctly
5. Click on inline element (bold, link) -> finds parent block element

## Dependencies
- **0048**: Markdown Preview (required - this extends it)
- **marked.js**: Already included via 0048
- **DOMPurify**: Already included via 0048

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| marked.js doesn't expose line numbers | Medium | High | Prototype early; fallback to Approach 2 or 3 |
| Line numbers off-by-one or incorrect | Medium | Medium | Thorough testing; visual indicator showing target line |
| Performance impact from line tracking | Low | Medium | Profile and optimize; lazy attribute addition |
| Complex nested structures confuse users | Medium | Low | Clear hover feedback; document limitations |

## Prototype Needed

Before finalizing this spec, need to verify marked.js line number tracking:

```javascript
// Test: Do marked.js tokens have accurate line positions?
const tokens = marked.lexer(markdownContent);
tokens.forEach(t => console.log(t.type, t.raw?.slice(0,20), 'line:', t.line));
```

If this doesn't work reliably, fall back to Approach 3 (floating markers).

## Expert Consultation

*To be completed after draft review*

## Approval
- [ ] Technical Lead Review
- [ ] Product Owner Review
- [ ] Expert AI Consultation Complete
- [ ] Prototype validates line tracking approach

## Notes
- This is an enhancement to 0048, not a replacement
- Consider future: showing existing annotations as highlights in preview
- Could extend to other file types with preview capability
