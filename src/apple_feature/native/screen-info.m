#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>
#import <string.h>
#import <unistd.h>

// Read geometry only, and never request Accessibility or screen-recording access.
static NSArray<NSValue *> *applicationMenuRects(void) {
    if (!AXIsProcessTrusted()) return nil;
    pid_t pid = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    if (pid <= 0) return nil;
    AXUIElementRef app = AXUIElementCreateApplication(pid);
    AXUIElementSetMessagingTimeout(app, 0.1);
    CFTypeRef menu = NULL, children = NULL;
    NSMutableArray *rects = nil;
    if (AXUIElementCopyAttributeValue(app, kAXMenuBarAttribute, &menu) == kAXErrorSuccess &&
        AXUIElementCopyAttributeValue((AXUIElementRef)menu, kAXChildrenAttribute, &children) == kAXErrorSuccess) {
        rects = [NSMutableArray array];
        for (id child in (__bridge NSArray *)children) {
            CFTypeRef position = NULL, size = NULL;
            CGPoint point; CGSize dimensions;
            BOOL valid = AXUIElementCopyAttributeValue((__bridge AXUIElementRef)child, kAXPositionAttribute, &position) == kAXErrorSuccess &&
                AXUIElementCopyAttributeValue((__bridge AXUIElementRef)child, kAXSizeAttribute, &size) == kAXErrorSuccess &&
                AXValueGetValue((AXValueRef)position, kAXValueCGPointType, &point) &&
                AXValueGetValue((AXValueRef)size, kAXValueCGSizeType, &dimensions);
            if (valid) [rects addObject:[NSValue valueWithRect:NSMakeRect(point.x, point.y, dimensions.width, dimensions.height)]];
            else rects = nil; // Partial metadata must not imply that the rest is empty.
            if (position) CFRelease(position);
            if (size) CFRelease(size);
            if (!rects) break;
        }
        if (!rects.count) rects = nil;
    }
    if (children) CFRelease(children);
    if (menu) CFRelease(menu);
    CFRelease(app);
    return rects;
}

static void excludeRect(CGRect rect, CGRect bar, CGFloat center, CGFloat *left, CGFloat *right) {
    if (!CGRectIntersectsRect(rect, bar) || CGRectIsEmpty(rect)) return;
    CGFloat min = CGRectGetMinX(rect) - CGRectGetMinX(bar);
    CGFloat max = CGRectGetMaxX(rect) - CGRectGetMinX(bar);
    if (max <= center) *left = MAX(*left, max);
    else if (min >= center) *right = MIN(*right, min);
    else { *left = center; *right = center; }
}

static NSString *menuBarContext(void) {
    NSWorkspace *workspace = NSWorkspace.sharedWorkspace;
    NSMutableArray<NSNumber *> *pids = [NSMutableArray array];
    for (NSRunningApplication *app in workspace.runningApplications) {
        pid_t pid = app.processIdentifier;
        if (pid > 0 && pid != getpid() && pid != getppid() && app.activationPolicy != NSApplicationActivationPolicyProhibited) {
            [pids addObject:@(pid)];
        }
    }
    [pids sortUsingSelector:@selector(compare:)];
    return [pids componentsJoinedByString:@","];
}

// Used only after a layout change when window metadata has no status-item bounds.
static NSDictionary *statusItemBoundary(void) {
    [NSApplication.sharedApplication setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSStatusItem *item = [NSStatusBar.systemStatusBar statusItemWithLength:1];
    NSRect previous = NSZeroRect;
    NSDictionary *result = nil;
    NSTimeInterval deadline = NSDate.timeIntervalSinceReferenceDate + 0.35;
    while (NSDate.timeIntervalSinceReferenceDate < deadline) {
        [NSRunLoop.currentRunLoop runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.01]];
        NSWindow *window = item.button.window;
        NSScreen *screen = window.screen;
        NSRect rect = [window convertRectToScreen:[item.button convertRect:item.button.bounds toView:nil]];
        CGFloat distance = screen ? NSMaxY(screen.frame) - NSMaxY(rect) : -1;
        if (screen && rect.size.width > 0 && distance >= 0 && distance < 64 && NSEqualRects(previous, rect)) {
            result = @{ @"id": screen.deviceDescription[@"NSScreenNumber"],
                @"right": @(NSMaxX(window.frame) - NSMinX(screen.frame)) };
            break;
        }
        previous = rect;
        [NSThread sleepForTimeInterval:0.02];
    }
    [NSStatusBar.systemStatusBar removeStatusItem:item];
    return result;
}

int main(int argc, char **argv) {
    @autoreleasepool {
        NSMutableArray *result = [NSMutableArray array];
        NSString *context = menuBarContext();
        NSArray *menus = applicationMenuRects();
        NSArray *windows = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
        NSDictionary *boundary = argc == 2 && strcmp(argv[1], "--measure-status-items") == 0 ? statusItemBoundary() : nil;
        for (NSScreen *screen in NSScreen.screens) {
            NSNumber *displayID = screen.deviceDescription[@"NSScreenNumber"];
            CGFloat top = 0, width = 0, x = 0;
            if (@available(macOS 12.0, *)) {
                top = screen.safeAreaInsets.top;
                NSRect left = screen.auxiliaryTopLeftArea;
                NSRect right = screen.auxiliaryTopRightArea;
                if (top > 0 && !NSIsEmptyRect(left) && !NSIsEmptyRect(right)) {
                    x = NSMaxX(left) - NSMinX(screen.frame);
                    width = NSMinX(right) - NSMaxX(left);
                }
            }
            CGFloat left = 0, right = CGRectGetWidth(CGDisplayBounds(displayID.unsignedIntValue));
            BOOL leftKnown = NO, rightKnown = NO;
            if (top > 0 && width > 0) {
                CGRect bar = CGDisplayBounds(displayID.unsignedIntValue); bar.size.height = top;
                CGFloat center = x + width / 2;
                // AX may describe the menu on another monitor only.
                for (NSValue *value in menus) {
                    if (CGRectIntersectsRect(NSRectToCGRect(value.rectValue), bar)) { leftKnown = YES; break; }
                }
                for (NSValue *value in menus) excludeRect(NSRectToCGRect(value.rectValue), bar, center, &left, &right);
                if ([boundary[@"id"] isEqual:displayID]) {
                    right = MIN(right, [boundary[@"right"] doubleValue]);
                    rightKnown = YES;
                }
                for (NSDictionary *window in windows) {
                    int layer = [window[(__bridge NSString *)kCGWindowLayer] intValue];
                    if ([window[(__bridge NSString *)kCGWindowOwnerPID] intValue] == getppid() ||
                        [window[(__bridge NSString *)kCGWindowOwnerPID] intValue] == getpid() ||
                        layer < CGWindowLevelForKey(kCGMainMenuWindowLevelKey) ||
                        [window[(__bridge NSString *)kCGWindowAlpha] doubleValue] == 0) continue;
                    CGRect rect;
                    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(__bridge NSString *)kCGWindowBounds], &rect)) continue;
                    // The menu-bar backdrop is a full-width window, not a menu item.
                    // The menu bar can be one point taller than the physical
                    // safe-area inset (39 vs 38 on a scaled MacBook display).
                    if (layer == CGWindowLevelForKey(kCGMainMenuWindowLevelKey) && CGRectGetWidth(rect) >= CGRectGetWidth(bar) && CGRectGetHeight(rect) <= ceil(top) + 1) continue;
                    // Large transparent overlay hosts are not menu-bar controls.
                    if (CGRectGetHeight(rect) > ceil(top) + 1 || !CGRectIntersectsRect(rect, bar)) continue;
                    excludeRect(rect, bar, center, &left, &right);
                    if (CGRectGetMaxX(rect) <= CGRectGetMinX(bar) + center) leftKnown = YES;
                    else if (CGRectGetMinX(rect) >= CGRectGetMinX(bar) + center) rightKnown = YES;
                    else { leftKnown = YES; rightKnown = YES; }
                }
            }
            [result addObject:@{ @"id": displayID, @"top": @(top), @"notchX": @(x), @"notchWidth": @(width),
                @"menuBarContext": context,
                @"menuBarLeft": leftKnown ? @(left) : NSNull.null,
                @"menuBarRight": rightKnown ? @(right) : NSNull.null }];
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
        fwrite(data.bytes, 1, data.length, stdout);
    }
    return 0;
}
