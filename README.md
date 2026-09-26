# COLT-A-CON

Build a complete web application from scratch called “COLT Market World”.

This is a highly interactive, browser-based, 2D multiplayer-style collectible trading world. The experience should feel like a premium modern Comic-Con convention combined with the nostalgic MapleStory Free Market.

The application must include:

A public player-facing game experience.

Secure user accounts.

A separate owner/admin management system.

A visual live map builder.

Character customization.

Stores and collectible inventories.

NPC management.

Credits, purchases, quests, rewards, and persistent progression.

Do not build a vendor or seller onboarding system. Regular users cannot create stores, upload products, or sell items. Only the owner/admin controls the map, stores, inventories, NPCs, quests, cosmetics, and game content.

1. TECHNOLOGY AND ARCHITECTURE

Use:

React

TypeScript

Tailwind CSS

Supabase for authentication, database, realtime features, and storage

Responsive desktop-first layout

Reusable modular components

Strong TypeScript types

Clear separation between player-facing features and admin features

Persistent database-backed state rather than temporary frontend mock state

React Query or an equivalent structured data-fetching solution

Row Level Security policies in Supabase

The project must be structured so that new maps, stores, NPCs, cosmetics, quests, currencies, and game mechanics can be added later without rebuilding the architecture.

Do not hardcode important game content directly inside React components. Store configurable content in the database.

Use mock assets and placeholders where final artwork is not yet uploaded, but build the full asset-upload and configuration system.

2. VISUAL STYLE

Create a vibrant, premium visual design using a:

3D pastel chrome aesthetic

Plasticine pop-art style

Retro comic-book details

High-end Comic-Con convention atmosphere

Playful collectible-card culture

Soft neon lighting

Chrome frames

Rounded plastic UI elements

Comic speech bubbles

Premium game dashboard appearance

The visual world should feel fun and nostalgic, but the interface should still feel polished, modern, organized, and professional.

Avoid a generic SaaS dashboard appearance on the player side.

The admin dashboard may be cleaner and more functional, while still keeping the COLT visual identity.

3. USER TYPES AND AUTHENTICATION

There are only two main account roles:

Player

A registered user who can:

Sign up

Log in

Create and customize a character

Enter the game world

Walk through the map

Visit stores

View and purchase items

Earn and purchase credits

Complete quests

Gain XP

Increase their level

Unlock titles

Unlock cosmetic items

Keep persistent progress

Use public and private chat

View their inventory and purchase history

Players cannot:

Create stores

Become vendors

Upload products for sale

Edit the map

Create NPCs

Edit quests

Access admin pages

Owner / Admin

Create a protected owner role with complete access to the management system.

Initial owner account:

Username: astratego
Password: Astratego1!

Do not expose or hardcode these credentials in frontend source code.

Create the first admin account securely through Supabase Auth, a database seed process, a secure server-side setup function, or environment variables.

The admin must have a role such as:

owner

Protect all admin routes using both:

Frontend route guards

Database Row Level Security

Do not rely only on hiding admin buttons in the interface.

4. AUTHENTICATION FLOW

Create the following screens:

Login

Registration

Forgot password

Reset password

First-time character setup

Returning player loading screen

Admin login

Unauthorized access screen

After registration:

The player creates a username.

The player creates their starting character.

The player selects only free starter cosmetics.

The player receives a configurable starting credit balance.

The player enters the active map.

After future logins, restore:

Character appearance

Current map

Last saved position

Credits

XP

Level

Titles

Owned cosmetics

Equipped cosmetics

Quest progress

Purchased items

Inventory

Chat identity

5. PLAYER DASHBOARD AND GAME LAYOUT

Create a responsive desktop game interface with these main areas:

Center: Game World

A large fixed-aspect-ratio 2D game viewport.

The world must support:

Left and right movement

Jumping

Falling

Platforms

Gravity

Collision detection

Interactable objects

Store entrances

NPC interaction

Animated environmental elements

Camera following the current player

Map boundaries

Spawn points

Teleport points

Layered backgrounds

Foreground decorations

Controls:

Arrow keys

A and D for movement

W or Space for jumping

S or down arrow for dropping from supported platforms

E for interaction

Mouse and touch interaction where relevant

Movement must feel smooth, responsive, and game-like.

Right Sidebar: Active Players

Show a realtime list of currently active users.

Each row should include:

Avatar preview

Username

Level

Active title

Online status

Current map or zone

Clicking a user opens a small profile and interaction panel with:

View profile

Send private message

View public achievements

Close panel

Do not show private account information.

Bottom Area: Global Chat

Create a live global chat with:

Realtime messages

Username

Avatar

Level badge

Active title

Timestamp

Text input

Send button

Basic moderation controls

Message rate limiting

Muted and blocked user support

When a player sends a public message, optionally display the message temporarily in a speech bubble above their character.

Also support private conversations between players.

6. CHARACTER CREATOR

Create a layered 2D character customization system.

Character appearance should be composed from multiple independently configurable visual layers.

Possible layer types:

Body

Skin tone

Face

Eyes

Hair

Shirt

Pants

Shoes

Hat

Glasses

Mask

Cape

Back accessory

Handheld item

Aura

Pet

Special effect

The system must support:

Male, female, neutral, or unrestricted visual bases

Previewing changes before saving

Equipping and unequipping items

Layer order control

Compatibility rules

Free cosmetics

Paid cosmetics

Locked cosmetics

Quest reward cosmetics

Level-restricted cosmetics

Limited-edition cosmetics

Each cosmetic item should have configurable fields:

Name

Internal slug

Category

Layer type

Image or sprite file

Thumbnail

Display order

Layer order

Free or paid

Credit price

Required level

Quest requirement

Active or inactive

Limited edition

Start date

End date

Compatibility metadata

Create a starter character selection screen that shows only eligible free starting items.

7. PLAYER CREDITS AND ECONOMY

Every player has a persistent credit balance.

Credits can be:

Granted when the account is created

Purchased with real money

Earned from quests

Earned from achievements

Granted manually by the owner

Deducted when purchasing cosmetics or eligible products

Refunded manually by the owner

Create a complete credit ledger.

Every credit change must create a transaction record containing:

User

Amount

Transaction type

Balance before

Balance after

Related item

Related quest

Related order

Admin responsible, when relevant

Description

Date and time

Never update the credit balance without also creating a ledger transaction.

Prevent users from:

Purchasing without enough credits

Manipulating their own balance

Reusing the same reward

Claiming a quest reward multiple times

Credit calculations and purchases must be validated securely on the backend or through secure Supabase functions.

8. BUYING CREDITS

Create a credit purchase page.

The owner can configure credit packages such as:

100 credits

500 credits

1,000 credits

2,500 credits

Each package should contain:

Package name

Credit amount

Price

Currency

Optional bonus credits

Active or inactive status

Display order

Featured status

Build the database and order flow so that a payment provider can be connected.

For the initial version, create a simulated payment flow with clearly separated payment-provider logic.

Do not falsely mark a payment as successful from the frontend.

Create order statuses:

Pending

Paid

Failed

Cancelled

Refunded

Credits should only be added after a confirmed successful payment state.

9. PLAYER PROFILE

Create a full player profile with:

Username

Avatar

Character preview

Level

XP

Active title

Registration date

Credits

Quest completion statistics

Achievements

Owned cosmetics

Equipped cosmetics

Purchased store items

Recent activity

Credit history

Settings

Player settings should include:

Sound on or off

Music on or off

Chat visibility

Private message permissions

Blocked users

Language-ready architecture

Logout

10. QUEST AND PROGRESSION SYSTEM

Create a database-backed quest engine.

Quest types may include:

Daily

Weekly

One-time

Tutorial

Event

Achievement

Hidden quest

Example quests:

Log in today

Maintain a 3-day login streak

Visit 3 different stores

Speak with 3 NPCs

Send a public chat message

Start a private chat

Purchase an item

Equip a new cosmetic

Visit a specific map location

Spin the Wheel of Fortune

Spend a configurable number of credits

Each quest should support:

Name

Description

Icon

Quest type

Start date

End date

Repeat frequency

Required action type

Target amount

Progress tracking

Credit reward

XP reward

Cosmetic reward

Title reward

Prerequisite quest

Required level

Active or inactive status

Manual or automatic claim

Sort order

Create a player quest panel showing:

Active quests

Current progress

Completed quests

Claimable rewards

Time remaining

Quest history

Progress must be stored persistently.

Daily quests should reset according to a configurable timezone.

Make the timezone configurable by the owner, with Israel time as the initial default.

11. LEVELS, XP, AND TITLES

Create a configurable progression system.

The owner can define:

Level number

XP required

Credit reward

Cosmetic reward

Title reward

Unlockable features

Player titles can include examples such as:

New Collector

Card Hunter

Market Explorer

Master Collector

Vault Legend

Titles should support:

Name

Description

Icon

Unlock rule

Level requirement

Quest requirement

Purchase option

Credit price

Active status

Players can select one unlocked title as their active title.

12. STORES

Only the owner creates and manages stores.

Stores are placed visually on maps using the admin map editor.

Each store should include:

Name

Internal slug

Description

Store type

Store visual template

Store image or sprite

Thumbnail

Position on map

Width

Height

Interaction area

Entry point

Display layer

Active status

Opening state

Inventory

Store categories

Optional background music

Optional sound effect

Optional internal store screen

Optional link to another map or interior

Store examples:

COLT Marketplace

Wheel of Fortune

Mystery Box Station

Avatar and Skin Boutique

Pokémon Collectibles Store

Sports Card Store

One Piece Store

Marvel and Disney Store

Graded Slab Vault

Event Store

When a player interacts with a store, open either:

A store modal

A full store screen

An interior map

A mini-game

A product catalog

The interaction type must be configurable per store.

13. STORE VISUAL TEMPLATES

Create an admin-managed library of store appearances.

The owner can upload and configure new store visual types.

Each store appearance should include:

Name

Category

Main sprite or image

Preview thumbnail

Optional animation

Width

Height

Default interaction area

Default entrance point

Layer settings

Collision settings

Optional lighting effect

Optional sign location

Optional customizable store sign

Active status

Once a store appearance is added, it should become available in the live map editor.

The owner should be able to reuse the same store appearance for multiple store instances.

Separate:

Store visual template

Store instance

Store inventory

Store location

Do not combine all store data into one inflexible database record.

14. STORE PRODUCTS

The owner can create and manage products for stores.

Product fields:

Product name

Description

Category

Brand or universe

Product image

Additional gallery images

Product type

Credit price

Optional real-money price

In-stock status

Stock quantity

Unlimited stock option

Purchase limit

Required level

Required quest

Limited edition

Start date

End date

Store assignment

Active or inactive status

Product types may include:

Physical collectible

Digital collectible

Avatar cosmetic

Booth decoration

Title

Mystery box

Coupon

Game reward

Special access item

Create a cart and checkout flow suitable for credit purchases.

Physical items should request shipping information.

Digital and cosmetic products should be delivered automatically after a successful purchase.

15. OFFICIAL COLT EXPERIENCES

Create configurable versions of these official map locations:

Wheel of Fortune

A mini-game where users can spin a wheel.

The owner configures:

Possible rewards

Reward probability

Daily spin limit

Credit cost per spin

Free spins

Quest connection

Active campaign dates

Rewards may include:

Credits

XP

Cosmetics

Titles

Coupons

No reward

Special items

Spin results must be securely determined and saved.

COLT Marketplace

A premium collectible catalog controlled entirely by the owner.

Mystery Box Station

Users can browse and purchase mystery boxes.

Each box includes:

Name

Image

Price

Possible rewards

Guaranteed value information

Rarity tiers

Stock

Opening animation

Purchase history

Avatar and Skin Boutique

A dedicated shop for character customization items.

16. NPC SYSTEM

NPCs should not use artificial intelligence.

NPC behavior is based only on configured rules and predefined text.

The owner can create, edit, duplicate, activate, deactivate, and delete NPCs.

NPC fields:

Name

Internal slug

NPC appearance

Sprite or image

Map assignment

Spawn position

Walking route

Movement speed

Walking range

Idle duration

Direction

Collision behavior

Interaction enabled

Random speech enabled

Speech interval minimum

Speech interval maximum

Active status

Each NPC can have a list of predefined text messages.

The NPC should randomly select one of its enabled messages every configurable amount of time.

NPC message fields:

Message text

Enabled status

Weight or probability

Minimum level requirement

Optional start date

Optional end date

Optional interaction-only setting

Optional automatic speech setting

NPCs may:

Stand still

Walk between two points

Follow a configured route

Wander inside a limited area

Speak automatically

Speak when clicked

Open a quest

Open a store

Teleport a player

Give a one-time reward

Do not connect NPCs to an AI model or chatbot.

17. ADMIN DASHBOARD

Create a separate protected admin area under a route such as:

/owner

The admin interface should include:

Overview dashboard

Map builder

Maps

Store templates

Stores

Store inventory

Products

NPC appearances

NPCs

NPC messages

Character bases

Cosmetic categories

Cosmetics

Players

Credits

Credit transactions

Credit packages

Orders

Quests

Quest rewards

Levels

XP rules

Titles

Chat moderation

Upload library

Game settings

Audit logs

The dashboard overview should show:

Total players

Active players

New registrations

Credits purchased

Credits awarded

Credits spent

Active quests

Completed quests

Popular stores

Popular cosmetics

Recent purchases

Recent admin activity

System alerts

18. VISUAL LIVE MAP BUILDER

The most important owner feature is a visual live map editor.

The owner must be able to build and edit the game map without manually changing code.

Create a drag-and-drop map builder with a live preview.

The map builder should support:

Creating a new map

Naming the map

Setting map width

Setting map height

Setting viewport size

Uploading a background

Uploading multiple background layers

Uploading foreground layers

Parallax configuration

Grid display

Grid snapping

Zoom controls

Pan controls

Undo

Redo

Save draft

Publish

Duplicate map

Archive map

Set as active map

The owner can place:

Platforms

Ground

Walls

Invisible boundaries

Spawn points

Stores

NPCs

Decorations

Signs

Animated objects

Teleport points

Doors

Portals

Interaction zones

Quest trigger zones

Music zones

Lighting zones

Every placed object should support:

X position

Y position

Width

Height

Scale

Rotation

Layer order

Visibility

Collision

Interaction

Locked state

Duplicate

Delete

Dragging

Resizing

Precise numeric editing

Create a left-side asset library containing:

Store visual templates

NPC appearances

Decorations

Platforms

Portals

Signs

Interactive objects

Create a right-side properties panel for the currently selected object.

Create a top toolbar for:

Select

Move

Add

Delete

Duplicate

Undo

Redo

Zoom

Preview

Save

Publish

Include a Live Show / Play Preview mode.

In Live Show mode, the owner can instantly walk through the draft map as a player and test:

Movement

Jumping

Collisions

Store interaction

NPC placement

NPC speech

Portals

Spawn points

Interaction zones

Camera behavior

The owner should be able to exit preview mode and continue editing without losing changes.

Published maps should be versioned.

Do not overwrite the currently published map until the owner explicitly clicks Publish.

Store:

Draft version

Published version

Version history

Updated by

Updated date

Publish date

19. MAP DATA MODEL

Build map objects in a flexible entity-based structure.

Suggested concepts:

maps

map_versions

map_layers

map_objects

map_spawn_points

map_portals

map_trigger_zones

store_visual_templates

store_instances

npc_appearance_templates

npc_instances

asset_library

A map object should reference an asset or entity rather than duplicating all of its content.

For example:

A store visual template defines how a store looks.

A store record defines its content and inventory.

A store instance defines where it appears on a specific map.

Use JSON metadata only for optional flexible settings. Do not place all important searchable fields inside a single JSON column.

20. ASSET LIBRARY

Create a reusable admin asset library.

The owner can upload:

Character layers

Hair styles

Hats

Capes

Clothes

Accessories

NPC appearances

Store visuals

Decorations

Backgrounds

Foregrounds

Platforms

Animated GIFs

Sprite sheets

Icons

Product images

Sound effects

Music

Each asset should contain:

Name

Asset type

File URL

Thumbnail

Width

Height

File format

Tags

Category

Active status

Upload date

Uploaded by

Allow searching, filtering, previewing, renaming, replacing, and archiving assets.

Do not permanently break existing objects when replacing an asset.

21. PLAYER MANAGEMENT

Create an admin player management page.

The owner can:

Search users

View profiles

View character appearance

View level and XP

View credit balance

View credit history

View quest progress

View purchases

Grant credits

Deduct credits

Grant cosmetics

Remove cosmetics

Grant titles

Suspend a player

Mute a player

Block public chat access

Reset quest progress

Reset character appearance

Add an admin note

Every manual action must create an audit log.

Do not allow the owner to directly edit a balance without recording the adjustment reason.

22. CHAT MODERATION

Create moderation tools for:

Viewing recent public messages

Searching messages

Deleting inappropriate messages

Muting users

Temporary mutes

Permanent mutes

Blocking private messages

Reviewing reported users

Reviewing reported messages

Add basic automated protections:

Rate limiting

Duplicate-message prevention

Maximum message length

Basic prohibited-word list

Link restriction

Spam protection

The owner can manage prohibited words from the dashboard.

23. DATABASE SECURITY

Create appropriate Supabase tables, relations, indexes, and Row Level Security policies.

Players may:

Read their own private profile

Update only approved profile fields

Read public player information

Read published game content

Read their own orders

Read their own transactions

Read their own quest progress

Read their own inventory

Create permitted chat messages

Create permitted purchase requests

Players may not:

Change their credit balance

Grant themselves cosmetics

Complete quests manually

Change reward records

Access admin notes

Read other users’ private data

Edit maps

Edit stores

Edit products

Edit NPCs

Access unpublished content

Only the owner role may manage game content.

Use secure database functions or server-side operations for:

Credit purchases

Reward claiming

Cosmetic purchases

Product purchases

Quest completion

Wheel results

Inventory delivery

Refunds

Manual credit adjustments

24. AUDIT LOGS

Create admin audit logs for important actions.

Each log should include:

Admin user

Action type

Entity type

Entity ID

Previous value when applicable

New value when applicable

Reason

Timestamp

Track actions such as:

Publishing maps

Editing stores

Editing products

Changing credit balances

Granting rewards

Suspending users

Editing quests

Editing NPCs

Refunds

Changing game settings

25. GAME SETTINGS

Create a configurable settings area for:

Game name

Logo

Favicon

Default map

Default spawn point

Starting credits

Starting level

Starting XP

Default free cosmetics

Maximum username length

Chat settings

Quest reset timezone

Movement speed

Jump strength

Gravity

Camera settings

Music volume

Sound volume

Maintenance mode

Registration enabled

Credit purchasing enabled

Current event

Global announcement

Do not hardcode these settings in the game components.

26. RESPONSIVE BEHAVIOR

Desktop is the primary experience.

For mobile and tablet:

Adapt the interface responsively

Replace keyboard controls with touch controls

Add left and right movement buttons

Add jump and interaction buttons

Collapse the online-player panel

Collapse or overlay the chat

Preserve access to quests, profile, credits, and stores

The admin map editor may show a message recommending desktop use on small screens, but standard admin content should remain responsive.

27. INITIAL DEMO CONTENT

Create sample content so the project is usable immediately.

Include:

One published demo map

One editable draft map

Several platforms

One spawn point

Four official COLT stores

Three NPCs

Several NPC messages

Four character base options

Multiple starter hair styles

Multiple free clothes

Two free hats

Several paid cosmetics

Three credit packages

Five daily quests

Three one-time tutorial quests

Five player titles

Ten sample store products

Example active-player data

Example global chat messages

Clearly mark sample content so the owner can replace or delete it.

28. REQUIRED PAGES

Player-facing pages:

Landing page

Login

Registration

Forgot password

Character setup

Game world

Player profile

Character customization

Cosmetic inventory

Quest center

Credit store

Purchase history

Settings

Admin pages:

Admin login

Dashboard

Maps

Live map builder

Asset library

Store visual templates

Stores

Products

NPC appearances

NPC management

NPC messages

Character bases

Cosmetics

Players

Credit transactions

Credit packages

Orders

Quests

Levels

Titles

Chat moderation

Audit logs

Game settings

29. IMPLEMENTATION PRIORITIES

Build the project in this order:

Phase 1:

Supabase connection

Authentication

Player and owner roles

Protected routes

Database structure

Row Level Security

Core app layout

Phase 2:

Character creator

Cosmetic asset structure

Player profile

Persistent character saving

Credits and transaction ledger

Phase 3:

Game viewport

Movement

Physics

Platforms

Camera

Map rendering

Phase 4:

Admin asset library

Store templates

NPC templates

Visual live map builder

Draft and publish flow

Phase 5:

Stores

Products

Purchases

Player inventory

Cosmetics shop

Phase 6:

Quests

XP

Levels

Titles

Rewards

Phase 7:

NPC movement

NPC predefined random speech

Realtime players

Global chat

Private chat

Phase 8:

Credit purchase infrastructure

Wheel of Fortune

Mystery boxes

Moderation

Analytics

Audit logs

Do not implement the project as disconnected visual mockups.

Every management page should be connected to the same database structure used by the player-facing application.

30. ACCEPTANCE CRITERIA

The project is considered successful when:

A new player can register and create a character.

The character and account progress are restored after logout and login.

A player can move and jump inside a database-configured map.

The owner can log into a protected admin area.

The owner can upload new character cosmetic assets.

Uploaded cosmetics become available in character customization.

The owner can mark cosmetics as free or set a credit price.

Players can purchase cosmetics using credits.

Every credit change appears in a secure transaction ledger.

The owner can create and edit NPCs.

NPCs can walk using configured movement rules.

NPCs randomly display predefined messages.

No NPC uses AI.

The owner can upload new store appearances.

Store appearances become available inside the map builder.

The owner can create a map with a configurable width and height.

The owner can drag stores, NPCs, platforms, decorations, and interaction zones onto the map.

The owner can test the map in Live Show preview mode.

The owner can save a draft without changing the live map.

The owner can publish a new map version.

Players see only the published map version.

Players can complete quests and receive credits or XP.

Quest progress remains after login.

Players cannot access vendor functionality because no vendor system exists.

Players cannot access unpublished maps or admin data.

Admin-only permissions are enforced by database security and not only by the UI.

The owner credentials are not exposed in the frontend source.

The architecture supports adding more maps and game features later.

Begin by creating the full application architecture, Supabase schema, authentication flow, role protection, database models, core player layout, and owner dashboard.

Do not reduce the project to a simple landing page or static visual prototype.

When a feature is too complex to fully finish in the first generation, create its complete database model, routes, reusable components, service layer, and functional initial version rather than replacing it with a decorative placeholder.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://colt-world-creator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b94da4e-3d77-49bf-a5a7-0c5c3e0e7d59).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
