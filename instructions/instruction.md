1. In a course edit page move field Status under field Base Price
2. Make dates uneditable (so user only can delete date or create a new one)
3. Make changes to api with the server:
 - `POST /api/proxy?action=update-course` need only those fields (other won't be able updated) example:
   {
   "id": 1,
   "title": "Updated Course Title",
   "status": "active",
   "basePrice": 149.99,
   }
 - `POST /api/proxy?action=save-dates` remove altogether (since we won't edit dates anymore)
 - add route and functionality for creating a new date for the course
 - add route and functionality for deleting existing date from the course
 - add route and functionality for creating a new course
 - Reflect those changes in docs/api.md