## Directory structure rule - project cursor rules - output be project-structure.mdc
@cursor-rules.mdc List all source files and folders in the project,
and create a new cursor rule outlining the directory structure and important files and folders.


## Tech stack rule - cursor rules special files example react

@cursor-rules.mdc @package.json Analyze all major dependencies
and create a cursor rule outlining the stack of the application
and the versions I'm using, and any remarks on best practices on those versions.

## Generating rules generically for any file type - cursor rules special files example react
### example1:
⚛️ LandingNewsletterInput.tsx  ⚛️ LandingNewsletterSection.tsx  📄 cursor-rules

@cursor-rules.mdc  @LandingNewsletterSection.tsx
/Generate Cursor Rules I want to generate a Cursor rule for the attached file. Please analyze it carefully and outline all of the conventions found. Output as one rule file only.
### example2:
@cursor-rules.mdc @components/ui/button.tsx
/Generate Cursor Rules
I want to generate a cursor rule for this React component. Please analyze it carefully and outline all of the conventions found. Output as one rule file only.


## Cursor rules for utility functions example  base46-to-blob.ts
@cursor-rules.mdc @utils/base64ToBlob.ts
/Generate Cursor Rules
I want to generate a cursor rule for this utility function.
Analyze it carefully and outline all of the conventions found. Output as one rule file only.


## Folder structure rule
.cursor/rules/
├─── frontend-components
│   ├─── landing-components.mdc
│   ├─── newsletter-components.mdc
│   ├─── pricing-components.mdc
│   ├─── ...
├─── backend-services
│   ├─── api-routes.mdc
│   ├─── database-queries.mdc
│   ├─── ...
│─── self-improvement.mdc
│─── project-structure.mdc
│─── cursor-rules.mdc
## https://pageai.pro/blog/cursor-rules-tutorial