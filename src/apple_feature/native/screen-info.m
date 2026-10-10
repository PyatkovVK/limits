#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

int main(void) {
    @autoreleasepool {
        NSMutableArray *result = [NSMutableArray array];
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
            [result addObject:@{ @"id": displayID, @"top": @(top), @"notchX": @(x), @"notchWidth": @(width) }];
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
        fwrite(data.bytes, 1, data.length, stdout);
    }
    return 0;
}
