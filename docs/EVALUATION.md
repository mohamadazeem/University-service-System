# Evaluation preparation

This guide follows the pasted request. The actual Mini Project Evaluation Rubric - COM.pdf was not supplied; verify this mapping and academic-integrity requirements against the original PDF before submitting. No score is guaranteed.

| Supplied criterion            | Evidence to demonstrate                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Create — 4                    | Validated service form; POST saves to MongoDB and refreshes the list                      |
| Read — 4                      | API-backed lists/details, real dashboard, search/filter/sort/pagination                   |
| Update — 4                    | Service edit persists; request status/assignment/comment updates                          |
| Delete — 4                    | Confirmed service deactivation; disappears from active catalogue while preserving history |
| Validation/error handling — 2 | Client fields, server validation, duplicate/ID/enum errors, retry states                  |
| Database design — 4           | Existing models, relationships, indexes and historical snapshots; DATABASE.md             |
| UI/UX/responsiveness — 2      | Navy layout, metric cards, charts, mobile sidebar, scrolling tables, focus handling       |
| Code quality/structure — 2    | Separate models/routes/controllers/validation and reusable frontend helpers               |
| Documentation — 2             | README, endpoint contract, ER diagram, test record and walkthrough                        |
| Demonstration — 2             | Persistent workflows and access-control checks in the student's own recording             |

## Suggested report, maximum 10 pages

Aim for 8–9 pages after exporting so screenshots and the diagram do not exceed ten:

1. Title, project overview and scope.
2. Stack, existing architecture and extension approach.
3. Database schema and relationships.
4. Authentication/authorization and provisioning.
5. Service CRUD with your actual screenshots.
6. Request and user management with actual screenshots.
7. Dashboard and responsive UI.
8. Test evidence and limitations.
9. Setup, reflection, references and disclosure of assistance as your institution requires.

This is an outline, not a fabricated completed report. Add your own explanations and actual screenshots. Verify the final exported page count.

## Demonstration, under five minutes

- 0:00–0:30: introduce the system, stack and database diagram.
- 0:30–1:10: student login, active catalogue and request submission; reload history.
- 1:10–1:40: admin login and real dashboard.
- 1:40–2:50: create, search/read, edit and deactivate/reactivate a service; refresh to show persistence.
- 2:50–3:40: request review, assignment, comments and valid status updates.
- 3:40–4:15: account details, role controls and deactivation; explain protected admin accounts.
- 4:15–4:45: student denial, invalid input and test output.
- 4:45–4:55: mobile layout and one maintainability/security explanation.

Prepare disposable demonstration records in your development database. Explain every operation yourself. Do not record passwords, JWTs, database URIs or environment secrets.
